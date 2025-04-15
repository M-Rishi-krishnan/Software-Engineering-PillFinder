import random
import psycopg2
import bcrypt
import requests
import os
import smtplib
from flask import Flask, request, jsonify,send_from_directory
from flask_cors import CORS
from flask_jwt_extended import create_access_token, jwt_required,verify_jwt_in_request,JWTManager, get_jwt_identity ,get_jwt
from psycopg2.extras import RealDictCursor
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from functools import wraps

app = Flask(__name__, static_folder='build', static_url_path='/')

@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

CORS(app, resources={r"/*": {"origins": "*"}})   

app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "default_jwt_secret")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "default_flask_secret")


jwt = JWTManager(app)

otp_storage = {}  

limiter = Limiter(
    key_func=get_remote_address, 
    app=app,
    default_limits=["1000 per day", "200 per hour"]  
)

@jwt.user_identity_loader
def user_identity_lookup(user):
    if isinstance(user, dict):
        return {
            "id": str(user.get("id", "")),
            "email": str(user.get("email", "")),
            "role": str(user.get("role", ""))
        }
    return str(user)  

def get_db_connection():
    return psycopg2.connect(
        dbname=os.environ.get("DB_NAME"),
        user=os.environ.get("DB_USER"),
        password=os.environ.get("DB_PASSWORD"),
        host=os.environ.get("DB_HOST"),
        port=os.environ.get("DB_PORT")
    )

def get_table_name(role):
    if role == "customer":
        return "users"
    elif role == "storeOwner":
        return "owners"
    elif role == "admin":
        return "admins"
    return None

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        jwt_claims = get_jwt()  
        role = jwt_claims.get("role")
        
        if role != "admin":
            return jsonify({"message": "Admin access required", "success": False}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def store_owner_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        jwt_claims = get_jwt() 
        role = jwt_claims.get("role")
        
        if role != "storeOwner":
            return jsonify({"message": "Store owner access required", "success": False}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def customer_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        jwt_claims = get_jwt() 
        role = jwt_claims.get("role")
        
        if role != "customer":
            return jsonify({"message": "Customer access required", "success": False}), 403
        
        return f(*args, **kwargs)
    return decorated_function

@app.route("/signup", methods=["POST"])
@limiter.limit("5 per minute")  
def signup():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")  

    if not email or not password or not role:
        return jsonify({"message": "Missing required fields!", "success": False}), 400

    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if role == "storeOwner":
            cursor.execute("SELECT id FROM owners WHERE email = %s", (email,))
            if cursor.fetchone():
                return jsonify({"message": "Email already in use!", "success": False}), 400
            
            cursor.execute("INSERT INTO owners (email, password) VALUES (%s, %s) RETURNING id", (email, hashed_pw))
            user_id = cursor.fetchone()[0]
        
        elif role == "customer":
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cursor.fetchone():
                return jsonify({"message": "Email already in use!", "success": False}), 400
            
            cursor.execute("INSERT INTO users (email, password) VALUES (%s, %s) RETURNING id", (email, hashed_pw))
            user_id = cursor.fetchone()[0]     
        
        else:
            return jsonify({"message": "Invalid role!", "success": False}), 400

        conn.commit()
        cursor.close()
        conn.close()

        access_token = create_access_token(
            identity=str(user_id),
            additional_claims={"email": email, "role": role}
        )

        if role == "storeOwner":
            return jsonify({
                "message": "Account created! Please create your store.",
                "redirect": "/create-store",
                "token": access_token,
                "success": True
            }), 201
        elif role == "customer":
            return jsonify({
                "message": "Account created! Redirecting to Medicine Search.",
                "redirect": "/medicine-search",
                "token": access_token,
                "success": True
            }), 201
        elif role == "admin":
            return jsonify({
                "message": "Account created! Redirecting to Admin Dashboard.",
                "redirect": "/admin-dashboard",
                "token": access_token,
                "success": True
            }), 201

    except psycopg2.Error as e:
        print(f"Database Error: {e}")
        return jsonify({"message": "Database error! Please try again.", "success": False}), 500

@app.route("/signin", methods=["POST"])
@limiter.limit("5 per minute")  
def signin():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not email or not password or not role:
        return jsonify({"message": "Missing required fields!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        table_name = get_table_name(role)
        cursor.execute("SELECT id, email, password FROM {} WHERE email = %s".format(table_name), (email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"message": "Invalid credentials!", "success": False}), 401

        user_id, user_email, stored_hashed_password = user

        if not bcrypt.checkpw(password.encode("utf-8"), stored_hashed_password.encode("utf-8")):
            return jsonify({"message": "Invalid credentials!", "success": False}), 401

        if role == "admin":
            cursor.execute("SELECT email, app_password FROM admins WHERE email = %s", (email,))
            admin_data = cursor.fetchone()

            if not admin_data:
                return jsonify({"message": "Admin credentials not found!", "success": False}), 401

            admin_email, app_password = admin_data  
            otp = str(random.randint(100000, 999999))
            otp_storage[email] = otp  

            try:
                server = smtplib.SMTP("smtp.gmail.com", 587)
                server.starttls()
                server.login(admin_email, app_password)

                message = f"Subject: Your Admin 2FA Code\n\nYour OTP code is: {otp}"
                server.sendmail(admin_email, email, message)

                server.quit()

                return jsonify({"message": "OTP sent to email", "step": "otp", "email": email, "success": True}), 200

            except smtplib.SMTPAuthenticationError:
                return jsonify({"message": "SMTP authentication failed. Check credentials.", "success": False}), 500

            except Exception as e:
                return jsonify({"message": f"Error sending email: {str(e)}", "success": False}), 500

        access_token = create_access_token(
        identity=str(user_id),  
        additional_claims={"email": user_email, "role": role})
        print("Generated token:", access_token)
        return jsonify({
            "message": f"Login successful as {role}!",
            "token": access_token,
            "redirect": "/admin-panel" if role == "admin" else ("/add-medicine" if role == "storeOwner" else "/medicine-search"),
            "success": True
        }), 200

    except psycopg2.Error as e:
        print("Login Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

    finally:
        cursor.close()
        conn.close()

@app.route("/auth0-signin", methods=["POST"])
@limiter.limit("5 per minute") 
def auth0_signin():
    data = request.json
    email = data.get("email")
    auth0_id = data.get("auth0Id")
    name = data.get("name")
    role = data.get("role")

    print(f"Received Auth0 login data: {data}")
    print(f"Extracted role from Auth0 state: {role}")
    if not email or not auth0_id or not name or not role:
        return jsonify({"message": "Missing required fields!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        table_name = get_table_name(role)
        if not table_name:
            return jsonify({"message": "Invalid role!", "success": False}), 400

        cursor.execute(f"SELECT id FROM {table_name} WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user:
            hashed_pw = bcrypt.hashpw(auth0_id.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cursor.execute(f"INSERT INTO {table_name} (email, password) VALUES (%s, %s) RETURNING id", (email, hashed_pw))
            user_id = cursor.fetchone()[0]
            redirect_url = "/create-store" if role == "storeOwner" else "/medicine-search"
        else:
            user_id = user[0]
            if role == "storeOwner":
                cursor.execute("""
                    SELECT s.id FROM stores s
                    JOIN owners o ON s.owner_id = o.id
                    WHERE o.email = %s
                """, (email,))
                store = cursor.fetchone()
                redirect_url = "/add-medicine" if store else "/create-store"
            else:
                redirect_url = "/medicine-search"

        conn.commit()
        cursor.close()
        conn.close()

        access_token = create_access_token(
            identity=str(user_id),
            additional_claims={"email": email, "role": role}
        )

        return jsonify({
            "message": f"Auth0 login successful as {role}!",
            "redirect": redirect_url,
            "token": access_token,
            "success": True
        }), 200

    except psycopg2.Error as e:
        print(f"Auth0 Login Error: {e}")
        return jsonify({"message": "Database error! Please try again.", "success": False}), 500

@app.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    email = data.get("email")
    otp = data.get("otp")

    if otp_storage.get(email) == otp:
        del otp_storage[email]
        access_token = create_access_token(
            identity=email, 
            additional_claims={"role": "admin"}  
        )
        return jsonify({"message": "2FA successful", "token": access_token, "success": True}), 200
    else:
        return jsonify({"message": "Invalid OTP", "success": False}), 401


@app.route("/create-store", methods=["POST"])
@jwt_required()
@store_owner_required
def create_store():
    data = request.json
    print("📥 Received Data:", data) 

    email = data.get("email")
    store_name = data.get("storeName")
    owner_name = data.get("ownerName")
    phone = data.get("phone")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    address = data.get("address")

    if not email or not store_name or latitude is None or longitude is None or not owner_name or not phone:
        print("Missing required fields!")
        return jsonify({"message": "All fields are required!", "success": False}), 400

    store_name = store_name.lower().replace(" ", "_")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM owners WHERE email = %s", (email,))
        owner = cursor.fetchone()

        if not owner:
            print("Store owner not found!")
            return jsonify({"message": "Store owner not found!", "success": False}), 404

        owner_id = owner[0]
        cursor.execute("SELECT id FROM stores WHERE name = %s", (store_name,))
        existing_store = cursor.fetchone()

        if existing_store:
            print("Store already exists!")
            return jsonify({"message": "Store already exists!", "success": False}), 400

        cursor.execute("""
            INSERT INTO stores (name, owner_id, address, latitude, longitude, owner_name, phone) 
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (store_name, owner_id, address, latitude, longitude, owner_name, phone))

        store_id = cursor.fetchone()[0]
        conn.commit()

        print(f"Store '{store_name}' created successfully with ID: {store_id}")

        store_table_name = f"store_{store_name}_medicines"
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {store_table_name} (
                id SERIAL PRIMARY KEY,  
                name VARCHAR(255) NOT NULL,
                stock INT NOT NULL CHECK (stock >= 0),
                price DECIMAL(10,2) NOT NULL CHECK (price >= 0)
            )
        """)
        conn.commit()

        print(f"Medicine table '{store_table_name}' created successfully!")

        cursor.close()
        conn.close()

        return jsonify({"message": "Store created successfully!", "storeId": store_id, "success": True}), 201

    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@jwt.unauthorized_loader
def unauthorized_callback(error):
    print(f"Unauthorized: {error}")
    return jsonify({"success": False, "message": f"Missing token: {error}"}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    print(f"Invalid token: {error}")
    return jsonify({"success": False, "message": f"Invalid token: {error}"}), 401

@app.route("/add-medicine", methods=["POST"])
@jwt_required()
@store_owner_required
def add_medicine():
    try:
        current_user = get_jwt_identity()
        print("JWT Identity:", current_user)
        jwt_claims = get_jwt()  
        role = jwt_claims.get("role")
        if role != "storeOwner":
            return jsonify({"success": False, "message": "Store owner access required"}), 403
        
        data = request.json
        print("Request data:", data)
        email = data.get("email")
        medicine_name = data.get("medicineName")
        stock = data.get("stock")
        price = data.get("price")
    
        if not email or not medicine_name or stock is None or price is None:
            return jsonify({"success": False, "message": "All fields are required"}), 400
    
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.id, s.name  
            FROM owners o  
            JOIN stores s ON o.id = s.owner_id  
            WHERE o.email = %s
        """, (email,))
        result = cursor.fetchone()

        if not result:
            return jsonify({"success": False, "message": "Store not found"}), 404

        store_id, store_name = result
        table_name = f"store_{store_name}_medicines"

        cursor.execute(f"SELECT stock FROM {table_name} WHERE name = %s", (medicine_name,))
        store_medicine = cursor.fetchone()

        if store_medicine:
            cursor.execute(f"""
                UPDATE {table_name} 
                SET stock = stock + %s, price = %s 
                WHERE name = %s
            """, (stock, price, medicine_name))
        else:
            cursor.execute(f"""
                INSERT INTO {table_name} (name, stock, price)  
                VALUES (%s, %s, %s)
            """, (medicine_name, stock, price))

        cursor.execute("""
            SELECT stock FROM medicines WHERE name = %s AND store_id = %s
        """, (medicine_name, store_id))
        global_medicine = cursor.fetchone()

        if global_medicine:
            cursor.execute("""
                UPDATE medicines 
                SET stock = stock + %s, price = %s 
                WHERE name = %s AND store_id = %s
            """, (stock, price, medicine_name, store_id))
        else:
            cursor.execute("""
                INSERT INTO medicines (name, store_id, pharmacy, stock, price)  
                VALUES (%s, %s, %s, %s, %s)
            """, (medicine_name, store_id, store_name, stock, price))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Medicine added/updated successfully"}), 201

    except Exception as e:
        print("Error in add_medicine:", str(e))
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/get-shop-owners", methods=["GET"])
@jwt_required()
@admin_required
def get_shop_owners():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT o.id, o.email, COALESCE(s.name, 'No Store') AS store_name
            FROM owners o
            LEFT JOIN stores s ON o.id = s.owner_id
        """)
        owners = cursor.fetchall()

        cursor.close()
        conn.close()

        owner_list = [{"id": row[0], "email": row[1], "store_name": row[2]} for row in owners]

        return jsonify({"shopOwners": owner_list, "success": True}), 200
    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@app.route("/delete-shop-owner", methods=["POST"])
@jwt_required()
@admin_required
def delete_shop_owner():
    data = request.json
    owner_id = data.get("ownerId")

    if not owner_id:
        return jsonify({"message": "Missing owner ID!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT email FROM owners WHERE id = %s", (owner_id,))
        owner = cursor.fetchone()

        if not owner:
            return jsonify({"message": "Shop owner not found!", "success": False}), 404

        cursor.execute("SELECT name FROM stores WHERE owner_id = %s", (owner_id,))
        store = cursor.fetchone()

        if store:
            store_name = store[0]
            store_table = f"store_{store_name}_medicines"
            cursor.execute(f"DROP TABLE IF EXISTS {store_table}")
            cursor.execute("DELETE FROM stores WHERE owner_id = %s", (owner_id,))

        cursor.execute("DELETE FROM owners WHERE id = %s", (owner_id,))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Shop owner and store deleted successfully!", "success": True}), 200

    except psycopg2.Error as e:
        print("Database Error:", e)  
        return jsonify({"message": "Database error! Please check server logs.", "success": False}), 500

@app.route("/add-admin", methods=["POST"])
@jwt_required()
@admin_required
def add_admin():
    data = request.json
    print("Received Data:", data)

    admin_email = data.get("adminEmail")  
    new_admin_email = data.get("email")
    new_admin_password = data.get("password")
    new_admin_app_password = data.get("appPassword") 

    if not admin_email or not new_admin_email or not new_admin_password or not new_admin_app_password:
        print("Missing fields in request!")
        return jsonify({"message": "All fields are required!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM admins WHERE email = %s", (new_admin_email,))
        if cursor.fetchone():
            return jsonify({"message": "Admin email already exists!", "success": False}), 400

        hashed_pw = bcrypt.hashpw(new_admin_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        cursor.execute(
            "INSERT INTO admins (email, password, app_password) VALUES (%s, %s, %s)",
            (new_admin_email, hashed_pw, new_admin_app_password)
        )

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "New admin added successfully!", "success": True}), 201

    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error! Please try again.", "success": False}), 500

@app.route("/delete-admin", methods=["POST"])
@jwt_required()
@admin_required
def delete_admin():
    data = request.json
    admin_id = data.get("adminId")

    if not admin_id:
        return jsonify({"message": "Missing admin ID!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT email FROM admins WHERE id = %s", (admin_id,))
        admin = cursor.fetchone()

        if admin and admin[0] == "rishikrishnanm007@gmail.com":
            return jsonify({"message": "Main admin cannot be deleted!", "success": False}), 403

        cursor.execute("DELETE FROM admins WHERE id = %s", (admin_id,))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"message": "Admin deleted successfully!", "success": True}), 200

    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500
 
@app.route("/search-stores", methods=["GET"])
def search_stores():
    query = request.args.get("query", "").strip().lower()

    if not query:
        return jsonify({"message": "Please enter a search term!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id, name FROM stores WHERE LOWER(name) LIKE %s", (f"%{query}%",))
        stores = cursor.fetchall()

        cursor.close()
        conn.close()

        if not stores:
            return jsonify({"message": "No stores found!", "success": False}), 404

        store_list = [{"id": row[0], "name": row[1]} for row in stores]

        return jsonify({"stores": store_list, "success": True}), 200

    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@app.route("/delete-store", methods=["POST"])
@jwt_required()
@admin_required
def delete_store():
    data = request.json
    store_id = data.get("storeId")

    if not store_id:
        return jsonify({"message": "Missing store ID!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT s.name, o.email FROM stores s JOIN owners o ON s.owner_id = o.id WHERE s.id = %s", 
            (store_id,)
        )
        store = cursor.fetchone()

        if not store:
            return jsonify({"message": "Store not found!", "success": False}), 404

        store_name, owner_email = store
        store_table = f"store_{store_name}_medicines"

        cursor.execute(f"DROP TABLE IF EXISTS {store_table}")
        cursor.execute("DELETE FROM stores WHERE id = %s", (store_id,))
        cursor.execute("DELETE FROM owners WHERE email = %s", (owner_email,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Store and owner deleted successfully!", "success": True}), 200

    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@app.route("/get-all-stores", methods=["GET"])
def get_all_stores():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.id, s.name, o.email AS owner_email 
            FROM stores s
            JOIN owners o ON s.owner_id = o.id
        """)
        stores = cursor.fetchall()

        cursor.close()
        conn.close()

        store_list = [{"id": row[0], "name": row[1], "owner_email": row[2]} for row in stores]

        return jsonify({"stores": store_list, "success": True}), 200
    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@app.route("/get-all-users", methods=["GET"])
def get_all_users():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, email, 'customer' AS role FROM users
            UNION ALL
            SELECT id, email, 'storeOwner' AS role FROM owners
            UNION ALL
            SELECT id, email, 'admin' AS role FROM admins
        """)
        users = cursor.fetchall()

        cursor.close()
        conn.close()
        user_list = [{"id": row[0], "email": row[1], "role": row[2]} for row in users]

        return jsonify({"users": user_list, "success": True}), 200

    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@app.route("/delete-user", methods=["POST"])
@jwt_required()
@admin_required
def delete_user():
    data = request.json
    user_id = data.get("userId")
    role = data.get("role")

    if not user_id or not role:
        return jsonify({"message": "Missing required fields!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if role == "customer":
            table = "users"
        elif role == "storeOwner":
            cursor.execute("SELECT id, name FROM stores WHERE owner_id = %s", (user_id,))
            store = cursor.fetchone()

            if store:
                store_id, store_name = store
                store_table = f"store_{store_name}_medicines"
                cursor.execute(f"DROP TABLE IF EXISTS {store_table}")

                cursor.execute("DELETE FROM stores WHERE id = %s", (store_id,))

            table = "owners"
        else:
            return jsonify({"message": "Invalid user role!", "success": False}), 400

        cursor.execute(f"DELETE FROM {table} WHERE id = %s", (user_id,))
        
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "User and associated store (if applicable) deleted successfully!", "success": True}), 200

    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@app.route("/get-all-medicines", methods=["GET"])
def get_all_medicines():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT m.id, m.name, m.stock, m.price, m.store_id,
                   s.name AS store_name, s.address AS store_address, s.phone AS store_phone
            FROM medicines m
            JOIN stores s ON m.store_id = s.id
            WHERE m.stock > 0 
        """)
        medicines = cursor.fetchall()

        for med in medicines:
            med["price"] = float(med["price"])

        cursor.close()
        conn.close()
        return jsonify({"success": True, "medicines": medicines})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/search-medicines", methods=["GET"])
def search_medicines():
    query = request.args.get("query", "*").strip().lower()
    latitude = request.args.get("latitude", type=float)
    longitude = request.args.get("longitude", type=float)
    store_query = request.args.get("store", "").strip().lower()

    if latitude is None or longitude is None:
        return jsonify({"message": "Missing location!", "success": False}), 400

    is_empty_search = (query == "*" and not store_query)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        if is_empty_search:
            sql_query = """
                SELECT 
                    m.name,
                    s.id AS store_id,
                    s.name AS store_name, 
                    m.stock, 
                    m.price, 
                    s.address AS store_address, 
                    s.phone AS store_phone,
                    (6371 * acos(
                        cos(radians(%s)) * cos(radians(s.latitude)) *
                        cos(radians(s.longitude) - radians(%s)) +
                        sin(radians(%s)) * sin(radians(s.latitude))
                    )) AS distance_km
                FROM medicines m
                JOIN stores s ON m.store_id = s.id
                WHERE m.stock > 0
                LIMIT 20;
            """
            cursor.execute(sql_query, (latitude, longitude, latitude))
            medicines = [
                {
                    "name": row[0],
                    "store_id": row[1],
                    "store_name": row[2],
                    "stock": row[3],
                    "price": float(row[4]),
                    "store_address": row[5],
                    "store_phone": row[6],
                    "distance_km": round(row[7], 2)
                }
                for row in cursor.fetchall()
            ]
        else:
            sql_query = """
                SELECT 
                    m.name, 
                    s.id AS store_id,
                    s.name AS store_name, 
                    m.stock, 
                    m.price, 
                    s.address AS store_address, 
                    s.phone AS store_phone,
                    (6371 * acos(
                        cos(radians(%s)) * cos(radians(s.latitude)) *
                        cos(radians(s.longitude) - radians(%s)) +
                        sin(radians(%s)) * sin(radians(s.latitude))
                    )) AS distance_km
                FROM medicines m
                JOIN stores s ON m.store_id = s.id
                WHERE m.stock > 0
                  AND (LOWER(m.name) LIKE %s OR %s = '*')
                  AND (LOWER(s.name) LIKE %s OR %s = '')
                ORDER BY distance_km ASC
                LIMIT 20;
            """
            cursor.execute(sql_query, (
                latitude, longitude, latitude,
                f"%{query}%", query,
                f"%{store_query}%", store_query
            ))
            medicines = [
                {
                    "name": row[0],
                    "store_id": row[1],
                    "store_name": row[2],
                    "stock": row[3],
                    "price": float(row[4]),
                    "store_address": row[5],
                    "store_phone": row[6],
                    "distance_km": round(row[7], 2)
                }
                for row in cursor.fetchall()
            ]

        cursor.close()
        conn.close()

        return jsonify({"success": True, "medicines": medicines}), 200

    except psycopg2.Error as e:
        print("Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500


@app.route("/get-medicines", methods=["GET"])
def get_medicines():
    email = request.args.get("email")
    if not email:
        return jsonify({"success": False, "message": "User email is required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.name  
            FROM owners o  
            JOIN stores s ON o.id = s.owner_id  
            WHERE o.email = %s
        """, (email,))
        result = cursor.fetchone()

        if not result:
            return jsonify({"success": False, "message": "Store not found"}), 404

        store_name = result[0]
        table_name = f"store_{store_name}_medicines"

        cursor.execute(f"SELECT name, stock, price FROM {table_name}")
        medicines = [
            {"medicineName": row[0], "stock": row[1], "price": float(row[2])}
            for row in cursor.fetchall()
        ]

        cursor.close()
        conn.close()

        return jsonify({"success": True, "medicines": medicines}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/get-store", methods=["GET"])
def get_store():
    email = request.args.get("email")
    if not email:
        return jsonify({"success": False, "message": "User email is required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.name  
            FROM owners o  
            JOIN stores s ON o.id = s.owner_id  
            WHERE o.email = %s
        """, (email,))
        result = cursor.fetchone()

        cursor.close()
        conn.close()

        if result:
            return jsonify({"success": True, "store": result[0]}), 200
        else:
            return jsonify({"success": False, "message": "Store not found"}), 404

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/update-medicine", methods=["POST"])
def update_medicine():
    data = request.json
    email = data.get("email")
    medicine_name = data.get("medicineName")
    new_stock = data.get("stock")
    new_price = data.get("price")

    if not email or not medicine_name or new_stock is None or new_price is None:
        return jsonify({"success": False, "message": "All fields are required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.id, s.name  
            FROM owners o  
            JOIN stores s ON o.id = s.owner_id  
            WHERE o.email = %s
        """, (email,))
        result = cursor.fetchone()

        if not result:
            return jsonify({"success": False, "message": "Store not found"}), 404

        store_id, store_name = result
        table_name = f"store_{store_name}_medicines"

        cursor.execute(f"SELECT stock FROM {table_name} WHERE name = %s", (medicine_name,))
        store_medicine = cursor.fetchone()

        if not store_medicine:
            return jsonify({"success": False, "message": "Medicine not found in store"}), 404

        cursor.execute(f"""
            UPDATE {table_name} 
            SET stock = %s, price = %s 
            WHERE name = %s
        """, (new_stock, new_price, medicine_name))

        cursor.execute("""
            UPDATE medicines 
            SET stock = %s, price = %s 
            WHERE name = %s AND store_id = %s
        """, (new_stock, new_price, medicine_name, store_id))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Medicine updated successfully"}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/delete-medicine", methods=["POST"])
def delete_medicine():
    data = request.json
    email = data.get("email")
    medicine_name = data.get("medicineName")

    if not email or not medicine_name:
        return jsonify({"success": False, "message": "Email and medicine name are required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, s.name  
            FROM owners o  
            JOIN stores s ON o.id = s.owner_id  
            WHERE o.email = %s
        """, (email,))
        result = cursor.fetchone()

        if not result:
            return jsonify({"success": False, "message": "Store not found"}), 404

        store_id, store_name = result
        table_name = f"store_{store_name}_medicines"

        cursor.execute(f"DELETE FROM {table_name} WHERE name = %s", (medicine_name,))
        cursor.execute("""
            DELETE FROM medicines 
            WHERE name = %s AND store_id = %s
        """, (medicine_name, store_id))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Medicine deleted successfully"}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/admin-delete-medicine", methods=["OPTIONS"])
def admin_delete_medicine_options():
    response = jsonify({"success": True})
    response.headers.add("Access-Control-Allow-Methods", "POST")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    return response

@app.route("/admin-delete-medicine", methods=["POST", "OPTIONS"])
@jwt_required()
@admin_required
def admin_delete_medicine():
    data = request.json
    medicine_id = data.get("medicineId")
    store_id = data.get("storeId")
    medicine_name = data.get("medicineName")

    if not medicine_id or not store_id or not medicine_name:
        return jsonify({"success": False, "message": "Medicine ID, store ID, and medicine name are required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM stores WHERE id = %s", (store_id,))
        result = cursor.fetchone()

        if not result:
            return jsonify({"success": False, "message": "Store not found"}), 404

        store_name = result[0]
        table_name = f"store_{store_name}_medicines"

        cursor.execute(f"DELETE FROM {table_name} WHERE name = %s", (medicine_name,))
        cursor.execute("""
            DELETE FROM medicines 
            WHERE id = %s AND store_id = %s
        """, (medicine_id, store_id))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Medicine deleted successfully"}), 200

    except Exception as e:
        print(f"Error in admin_delete_medicine: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/get-directions", methods=["GET"])
def get_directions():
    start_lat = request.args.get("start_lat")
    start_lon = request.args.get("start_lon")
    end_lat = request.args.get("end_lat")
    end_lon = request.args.get("end_lon")
    
    if not all([start_lat, start_lon, end_lat, end_lon]):
        return jsonify({"error": "Missing required parameters"}), 400
    
    try:
        ors_api_key = os.environ.get("ORS_API_KEY")
        url = f"https://api.openrouteservice.org/v2/directions/driving-car?api_key={ors_api_key}&start={start_lon},{start_lat}&end={end_lon},{end_lat}"

        response = requests.get(url)
        if response.status_code == 200:
            return jsonify(response.json()), 200
        else:
            return jsonify({"error": f"OpenRouteService API error: {response.status_code}", "details": response.text}), response.status_code
    
    except Exception as e:
        print("Error fetching directions:", str(e))
        return jsonify({"error": "Failed to get directions", "details": str(e)}), 500



@app.route("/get-store-coordinates", methods=["GET"])
def get_store_coordinates():
    store_id = request.args.get("store_id")
    if not store_id:
        return jsonify({"success": False, "message": "Store ID is required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT latitude, longitude FROM stores WHERE id = %s", (store_id,))
        result = cursor.fetchone()

        cursor.close()
        conn.close()

        if result:
            latitude, longitude = result
            return jsonify({"success": True, "latitude": latitude, "longitude": longitude}), 200
        else:
            return jsonify({"success": False, "message": "Store not found"}), 404

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True) 