
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import bcrypt
from flask_jwt_extended import create_access_token, jwt_required, JWTManager, get_jwt_identity ,get_jwt
from psycopg2.extras import RealDictCursor
import random
from flask_mail import Mail, Message
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import smtplib
from flask_principal import Principal, Identity, AnonymousIdentity, identity_changed
from flask_principal import RoleNeed, Permission, identity_loaded, UserNeed
from functools import wraps
from flask_login import current_user

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.config["JWT_SECRET_KEY"] = "supersecuresecret"  # Change this!
app.config["SECRET_KEY"] = "supersecuresecret"  # For sessions

jwt = JWTManager(app)

# Configure Flask Mail (SMTP)
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 465
app.config["MAIL_USE_SSL"] = True  # Use SSL instead of TLS
app.config["MAIL_USE_TLS"] = False  # Disable TLS

principals = Principal(app)
# Define permissions
admin_permission = Permission(RoleNeed('admin'))
store_owner_permission = Permission(RoleNeed('storeOwner'))
customer_permission = Permission(RoleNeed('customer'))


mail = Mail(app)

otp_storage = {}  # Temporary store for OTPs (use Redis in production)

limiter = Limiter(
    key_func=get_remote_address,  # Limits based on client IP
    app=app,
    default_limits=["200 per day", "50 per hour"]  # Global limits (adjust as needed)
)



# Add a simple User class if you don't have one
class User:
    def __init__(self, id, role):
        self.id = id
        self.role = role
        self.is_authenticated = True

@app.route("/test-auth", methods=["POST"])
def test_auth():
    auth_header = request.headers.get('Authorization')
    return jsonify({
        "success": True,
        "message": "Auth test successful",
        "auth_header": auth_header,
        "has_bearer": auth_header.startswith("Bearer ") if auth_header else False,
        "token": auth_header.replace("Bearer ", "") if auth_header and auth_header.startswith("Bearer ") else None
    }), 200


@identity_loaded.connect_via(app)
def on_identity_loaded(sender, identity):
    # Set the identity user object
    if hasattr(current_user, 'id'):
        identity.user = current_user

    # Add the UserNeed to the identity
    if hasattr(current_user, 'id') and current_user.is_authenticated:
        identity.provides.add(UserNeed(current_user.id))

    # Add role to the identity
    if hasattr(current_user, 'role'):
        identity.provides.add(RoleNeed(current_user.role))

@jwt.user_identity_loader
def user_identity_lookup(user):
    if isinstance(user, dict):
        # Create a new dictionary with string values
        return {
            "id": str(user.get("id", "")),
            "email": str(user.get("email", "")),
            "role": str(user.get("role", ""))
        }
    return str(user)  # Ensure non-dict values are also strings


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]  # This will be the user_id as a string
    
    # Get additional claims
    email = jwt_data.get("email", "")
    role = jwt_data.get("role", "")
    
    # Create user object
    user = {"id": identity, "email": email, "role": role, "is_authenticated": True}
    
    # Set up Flask-Principal identity
    identity_obj = Identity(identity)
    identity_obj.provides.add(RoleNeed(role))
    identity_changed.send(app, identity=identity_obj)
    
    return user





# ✅ Function to Connect to PostgreSQL
def get_db_connection():
    return psycopg2.connect(
        dbname="pillfinder_db", user="postgres", password="mrk123456", host="localhost", port="5432"
    )

# ✅ Function to Get Table Name Based on Role
def get_table_name(role):
    if role == "customer":
        return "users"
    elif role == "storeOwner":
        return "owners"
    elif role == "admin":
        return "admins"
    return None

# ✅ User Signup Route
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")  # ✅ Capture role to decide table

    if not email or not password or not role:
        return jsonify({"message": "Missing required fields!", "success": False}), 400

    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ If storeOwner → Insert into `owners` table
        if role == "storeOwner":
            cursor.execute("SELECT id FROM owners WHERE email = %s", (email,))
            if cursor.fetchone():
                return jsonify({"message": "Email already in use!", "success": False}), 400
            
            cursor.execute("INSERT INTO owners (email, password) VALUES (%s, %s) RETURNING id", (email, hashed_pw))
            user_id = cursor.fetchone()[0]
        
        # ✅ If customer → Insert into `users` table
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

         # ✅ ADDED: Create token after successful signup
        access_token = create_access_token(
            identity=str(user_id),
            additional_claims={"email": email, "role": role}
        )

        # ✅ Redirect Based on Role
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
        print(f"❌ Database Error: {e}")
        return jsonify({"message": "Database error! Please try again.", "success": False}), 500

# ✅ User Login Route (with JWT)
# ✅ User Login Route (with JWT)
# Apply rate limiting to search route
@app.route("/signin", methods=["POST"])
#@limiter.limit("5 per minute")  # Limit login attempts
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
            # 🔹 Fetch the admin's email and app_password from the database
            cursor.execute("SELECT email, app_password FROM admins WHERE email = %s", (email,))
            admin_data = cursor.fetchone()

            if not admin_data:
                return jsonify({"message": "Admin credentials not found!", "success": False}), 401

            admin_email, app_password = admin_data  # Extract email and app_password

            # 🔹 Generate and store OTP
            otp = str(random.randint(100000, 999999))
            otp_storage[email] = otp  

            try:
                # 🔹 Send email using the fetched credentials
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

        # 🔹 Normal login for Store Owners & Customers
        access_token = create_access_token(
        identity=str(user_id),  # Convert ID to string as main identity
        additional_claims={"email": user_email, "role": role})
        print("Generated token:", access_token)
        # ✅ Store role in the session
        return jsonify({
            "message": f"Login successful as {role}!",
            "token": access_token,
            "redirect": "/admin-panel" if role == "admin" else ("/add-medicine" if role == "storeOwner" else "/medicine-search"),
            "success": True
        }), 200

    except psycopg2.Error as e:
        print("❌ Login Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

    finally:
        cursor.close()
        conn.close()



def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        jwt_claims = get_jwt()  # Get the JWT claims
        role = jwt_claims.get("role")
        
        if role != "admin":
            return jsonify({"message": "Admin access required", "success": False}), 403
        
        return f(*args, **kwargs)
    return decorated_function


def store_owner_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        jwt_claims = get_jwt()  # Get the JWT claims
        role = jwt_claims.get("role")
        
        if role != "storeOwner":
            return jsonify({"message": "Store owner access required", "success": False}), 403
        
        return f(*args, **kwargs)
    return decorated_function


def customer_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        jwt_claims = get_jwt()  # Get the JWT claims
        role = jwt_claims.get("role")
        
        if role != "customer":
            return jsonify({"message": "Customer access required", "success": False}), 403
        
        return f(*args, **kwargs)
    return decorated_function



@app.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    email = data.get("email")
    otp = data.get("otp")

    if otp_storage.get(email) == otp:
        del otp_storage[email]
        access_token = create_access_token(
            identity=email,  # String identity
            additional_claims={"role": "admin"}  # Add role as claim
        )
        return jsonify({"message": "2FA successful", "token": access_token, "success": True}), 200
    else:
        return jsonify({"message": "Invalid OTP", "success": False}), 401


# ✅ Store Creation Route
@app.route("/create-store", methods=["POST"])
@jwt_required()
@store_owner_required
def create_store():
    data = request.json
    print("📥 Received Data:", data)  # Debugging log

    email = data.get("email")
    store_name = data.get("storeName")
    owner_name = data.get("ownerName")
    phone = data.get("phone")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    address = data.get("address")

    # ✅ Validate required fields
    if not email or not store_name or latitude is None or longitude is None or not owner_name or not phone:
        print("❌ Missing required fields!")
        return jsonify({"message": "All fields are required!", "success": False}), 400

    # ✅ Ensure store name is formatted correctly
    store_name = store_name.lower().replace(" ", "_")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Check if owner exists
        cursor.execute("SELECT id FROM owners WHERE email = %s", (email,))
        owner = cursor.fetchone()

        if not owner:
            print("❌ Store owner not found!")
            return jsonify({"message": "Store owner not found!", "success": False}), 404

        owner_id = owner[0]

        # ✅ Check if store already exists
        cursor.execute("SELECT id FROM stores WHERE name = %s", (store_name,))
        existing_store = cursor.fetchone()

        if existing_store:
            print("❌ Store already exists!")
            return jsonify({"message": "Store already exists!", "success": False}), 400

        # ✅ Insert into `stores` table with latitude & longitude
        cursor.execute("""
            INSERT INTO stores (name, owner_id, address, latitude, longitude, owner_name, phone) 
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (store_name, owner_id, address, latitude, longitude, owner_name, phone))

        store_id = cursor.fetchone()[0]
        conn.commit()

        print(f"✅ Store '{store_name}' created successfully with ID: {store_id}")

        # ✅ Create Medicine Table for the Store
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

        print(f"✅ Medicine table '{store_table_name}' created successfully!")

        cursor.close()
        conn.close()

        return jsonify({"message": "Store created successfully!", "storeId": store_id, "success": True}), 201

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@jwt.unauthorized_loader
def unauthorized_callback(error):
    print(f"Unauthorized: {error}")
    return jsonify({"success": False, "message": f"Missing token: {error}"}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    print("Token has expired")
    return jsonify({"success": False, "message": "Token has expired"}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    print(f"Invalid token: {error}")
    return jsonify({"success": False, "message": f"Invalid token: {error}"}), 401
    


# ✅ Medicine Addition Route
@app.route("/add-medicine", methods=["POST"])
@jwt_required()
@store_owner_required
def add_medicine():
    try:
        current_user = get_jwt_identity()
        print("JWT Identity:", current_user)
        jwt_claims = get_jwt()  # Get the JWT claims
        role = jwt_claims.get("role")
        if role != "storeOwner":
            return jsonify({"success": False, "message": "Store owner access required"}), 403
        # Check if user is a store owner
        
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

        # Fetch store ID and store name (pharmacy name)
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

        # Check if the medicine already exists in the store's medicine table
        cursor.execute(f"SELECT stock FROM {table_name} WHERE name = %s", (medicine_name,))
        store_medicine = cursor.fetchone()

        if store_medicine:
            # Update stock if medicine exists
            cursor.execute(f"""
                UPDATE {table_name} 
                SET stock = stock + %s, price = %s 
                WHERE name = %s
            """, (stock, price, medicine_name))
        else:
            # Insert new medicine into the store-specific table
            cursor.execute(f"""
                INSERT INTO {table_name} (name, stock, price)  
                VALUES (%s, %s, %s)
            """, (medicine_name, stock, price))

        # Check if the medicine already exists in the global medicines table
        cursor.execute("""
            SELECT stock FROM medicines WHERE name = %s AND store_id = %s
        """, (medicine_name, store_id))
        global_medicine = cursor.fetchone()

        if global_medicine:
            # Update stock in the global medicines table
            cursor.execute("""
                UPDATE medicines 
                SET stock = stock + %s, price = %s 
                WHERE name = %s AND store_id = %s
            """, (stock, price, medicine_name, store_id))
        else:
            # **Insert the pharmacy name correctly**
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

# Medicine Search 
@app.route("/search-medicine", methods=["GET"])
def search_medicine():
    query = request.args.get("query", "").strip().lower()

    if not query:
        return jsonify({"message": "No search query provided", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Fetch medicines along with store details
        # ✅ Fetch medicines along with store details sorted by price (ascending)
        cursor.execute("""
        SELECT m.id, m.name, m.stock, m.price, s.name AS store_name, s.address
        FROM medicines m
        JOIN stores s ON m.store_id = s.id
        WHERE LOWER(m.name) LIKE %s
        ORDER BY m.price ASC  -- ✅ Sorting results by price in ascending order
        """, (f"%{query}%",))

        results = cursor.fetchall()

        cursor.close()
        conn.close()

        if not results:
            return jsonify({"message": "No medicines found", "success": False}), 404

        medicines = [
            {
                "id": row[0],
                "name": row[1],
                "stock": row[2],
                "price": float(row[3]),
                "store_name": row[4],
                "store_address": row[5]
            }
            for row in results
        ]

        return jsonify({"medicines": medicines, "success": True}), 200

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

#View all shop owners
@app.route("/get-shop-owners", methods=["GET"])
@jwt_required()
@admin_required
def get_shop_owners():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Fetch shop owners with their corresponding store name (if available)
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
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

#Delete the shop owner and their store
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

        # ✅ Check if the owner exists
        cursor.execute("SELECT email FROM owners WHERE id = %s", (owner_id,))
        owner = cursor.fetchone()

        if not owner:
            return jsonify({"message": "Shop owner not found!", "success": False}), 404

        # ✅ Check if the owner has a store
        cursor.execute("SELECT name FROM stores WHERE owner_id = %s", (owner_id,))
        store = cursor.fetchone()

        if store:
            store_name = store[0]
            store_table = f"store_{store_name}_medicines"

            # ✅ Drop the store's medicine table (if exists)
            cursor.execute(f"DROP TABLE IF EXISTS {store_table}")

            # ✅ Delete store record
            cursor.execute("DELETE FROM stores WHERE owner_id = %s", (owner_id,))

        # ✅ Delete owner account
        cursor.execute("DELETE FROM owners WHERE id = %s", (owner_id,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Shop owner and store deleted successfully!", "success": True}), 200

    except psycopg2.Error as e:
        print("❌ Database Error:", e)  # ✅ Print error for debugging
        return jsonify({"message": "Database error! Please check server logs.", "success": False}), 500

#Add Admins
@app.route("/add-admin", methods=["POST"])
@jwt_required()
@admin_required
def add_admin():
    data = request.json

    # ✅ Log incoming data for debugging
    print("Received Data:", data)

    admin_email = data.get("adminEmail")  # The existing admin making the request
    new_admin_email = data.get("email")
    new_admin_password = data.get("password")
    new_admin_app_password = data.get("appPassword")  # ✅ Store Gmail App Password

    if not admin_email or not new_admin_email or not new_admin_password or not new_admin_app_password:
        print("❌ Missing fields in request!")
        return jsonify({"message": "All fields are required!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Check if the requester is an existing admin
       # cursor.execute("SELECT id FROM admins WHERE email = %s", (admin_email,))
        #existing_admin = cursor.fetchone()

        #if not existing_admin:
         #   return jsonify({"message": "Unauthorized! Only admins can add new admins.", "success": False}), 403

        # ✅ Check if the new admin email is already registered
        cursor.execute("SELECT id FROM admins WHERE email = %s", (new_admin_email,))
        if cursor.fetchone():
            return jsonify({"message": "Admin email already exists!", "success": False}), 400

        # ✅ Hash the new admin password
        hashed_pw = bcrypt.hashpw(new_admin_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        # ✅ Insert the new admin into the database
        cursor.execute(
            "INSERT INTO admins (email, password, app_password) VALUES (%s, %s, %s)",
            (new_admin_email, hashed_pw, new_admin_app_password)
        )

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "New admin added successfully!", "success": True}), 201

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error! Please try again.", "success": False}), 500



# Delete Admin
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

        # ✅ Check if the admin being deleted is the main admin (email = '0')
        cursor.execute("SELECT email FROM admins WHERE id = %s", (admin_id,))
        admin = cursor.fetchone()

        if admin and admin[0] == "rishikrishnanm007@gmail.com":
            return jsonify({"message": "Main admin cannot be deleted!", "success": False}), 403

        # ✅ Delete the admin if they are not the main admin
        cursor.execute("DELETE FROM admins WHERE id = %s", (admin_id,))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"message": "Admin deleted successfully!", "success": True}), 200

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

#Search Stores 
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
        print("❌ Database Error:", e)
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

        # ✅ Fetch store name and owner email using a JOIN
        cursor.execute(
            "SELECT s.name, o.email FROM stores s JOIN owners o ON s.owner_id = o.id WHERE s.id = %s", 
            (store_id,)
        )
        store = cursor.fetchone()

        if not store:
            return jsonify({"message": "Store not found!", "success": False}), 404

        store_name, owner_email = store
        store_table = f"store_{store_name}_medicines"

        # ✅ Drop the store's medicine table
        cursor.execute(f"DROP TABLE IF EXISTS {store_table}")

        # ✅ Delete store record
        cursor.execute("DELETE FROM stores WHERE id = %s", (store_id,))

        # ✅ Delete the owner based on email
        cursor.execute("DELETE FROM owners WHERE email = %s", (owner_email,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Store and owner deleted successfully!", "success": True}), 200

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
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
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

#Get users for admin page
@app.route("/get-all-users", methods=["GET"])
def get_all_users():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Fetch all users, store owners, and admins
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

        # ✅ Format response
        user_list = [{"id": row[0], "email": row[1], "role": row[2]} for row in users]

        return jsonify({"users": user_list, "success": True}), 200

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

#Delete User from admin
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
            # ✅ Get the store ID before deleting the owner
            cursor.execute("SELECT id, name FROM stores WHERE owner_id = %s", (user_id,))
            store = cursor.fetchone()

            if store:
                store_id, store_name = store
                store_table = f"store_{store_name}_medicines"

                # ✅ Drop store's medicine table
                cursor.execute(f"DROP TABLE IF EXISTS {store_table}")

                # ✅ Delete store from `stores`
                cursor.execute("DELETE FROM stores WHERE id = %s", (store_id,))

            # ✅ Delete owner from `owners`
            table = "owners"
        else:
            return jsonify({"message": "Invalid user role!", "success": False}), 400

        # ✅ Delete user record
        cursor.execute(f"DELETE FROM {table} WHERE id = %s", (user_id,))
        
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "User and associated store (if applicable) deleted successfully!", "success": True}), 200

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@app.route("/get-all-medicines", methods=["GET"])
def get_all_medicines():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # ✅ Fetch medicines along with store details
        cursor.execute("""
            SELECT m.id, m.name, m.stock, m.price, 
                   s.name AS store_name, s.address AS store_address, s.phone AS store_phone
            FROM medicines m
            JOIN stores s ON m.store_id = s.id
        """)
        medicines = cursor.fetchall()

        # Convert price to float
        for med in medicines:
            med["price"] = float(med["price"])

        cursor.close()
        conn.close()
        return jsonify({"success": True, "medicines": medicines})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/search-medicines", methods=["GET"])
def search_medicines():
    query = request.args.get("query", "").strip().lower()
    latitude = request.args.get("latitude", type=float)
    longitude = request.args.get("longitude", type=float)

    # ✅ Debugging Logs
    print(f"📥 Received Query: {query}")
    print(f"📍 User Location: Latitude={latitude}, Longitude={longitude}")

    if not query or latitude is None or longitude is None:
        print("❌ Missing search query or location!")
        return jsonify({"message": "Missing search query or location!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Check if medicines table exists
        cursor.execute("SELECT tablename FROM pg_tables WHERE tablename LIKE 'store_%_medicines';")
        existing_tables = cursor.fetchall()
        print(f"📋 Available Medicine Tables: {existing_tables}")

        # ✅ Run SQL Query to find nearest stores with the medicine (No min distance)
        cursor.execute("""
            SELECT 
                m.name, 
                s.name AS store_name, 
                m.stock, 
                m.price, 
                s.address AS store_address, 
                s.phone AS store_phone,
                ( 6371 * acos( cos( radians(%s) ) * cos( radians( s.latitude ) ) * 
                  cos( radians( s.longitude ) - radians(%s) ) + 
                  sin( radians(%s) ) * sin( radians( s.latitude ) ) ) ) AS distance 
            FROM medicines m
            JOIN stores s ON m.store_id = s.id
            WHERE LOWER(m.name) LIKE %s
            ORDER BY distance ASC  -- Sort by closest store
            LIMIT 10;
        """, (latitude, longitude, latitude, f"%{query}%"))

        medicines = [
            {
                "name": row[0],
                "store_name": row[1],
                "stock": row[2],
                "price": float(row[3]),
                "store_address": row[4],
                "store_phone": row[5],
                "distance_km": round(row[6], 2)
            }
            for row in cursor.fetchall()
        ]

        cursor.close()
        conn.close()

        print("✅ Found Medicines:")
        for med in medicines:
            print(f"{med['name']} - {med['store_name']} ({med['distance_km']} km)")

        return jsonify({"success": True, "medicines": medicines}), 200

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500

@app.route("/suggest-medicines", methods=["GET"])
def suggest_medicines():
    query = request.args.get("query", "").strip()

    if not query:
        return jsonify({"success": False, "error": "Query is empty"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT DISTINCT name FROM medicines WHERE LOWER(name) LIKE %s LIMIT 5",
            (f"%{query.lower()}%",)
        )
        suggestions = [row[0] for row in cursor.fetchall()]

        cursor.close()
        conn.close()
        return jsonify({"success": True, "suggestions": suggestions})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ✅ API: Get Medicines for a Specific Store
@app.route("/get-medicines", methods=["GET"])
def get_medicines():
    email = request.args.get("email")
    if not email:
        return jsonify({"success": False, "message": "User email is required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Fetch store name from owners and stores table
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

        # Fetch store ID and store name
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

        # Check if the medicine exists in the store's medicine table
        cursor.execute(f"SELECT stock FROM {table_name} WHERE name = %s", (medicine_name,))
        store_medicine = cursor.fetchone()

        if not store_medicine:
            return jsonify({"success": False, "message": "Medicine not found in store"}), 404

        # Update stock and price in the store-specific medicines table
        cursor.execute(f"""
            UPDATE {table_name} 
            SET stock = %s, price = %s 
            WHERE name = %s
        """, (new_stock, new_price, medicine_name))

        # Update stock and price in the global medicines table
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

if __name__ == "__main__":
    app.run(debug=True) 
