from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import bcrypt

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

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
        
        # ✅ If admin → Insert into `admins` table (if applicable)
        elif role == "admin":
            cursor.execute("SELECT id FROM admins WHERE email = %s", (email,))
            if cursor.fetchone():
                return jsonify({"message": "Email already in use!", "success": False}), 400
            
            cursor.execute("INSERT INTO admins (email, password) VALUES (%s, %s) RETURNING id", (email, hashed_pw))
            user_id = cursor.fetchone()[0]
        
        else:
            return jsonify({"message": "Invalid role!", "success": False}), 400

        conn.commit()
        cursor.close()
        conn.close()

        # ✅ Redirect Based on Role
        if role == "storeOwner":
            return jsonify({
                "message": "Account created! Please create your store.",
                "redirect": "/create-store",
                "success": True
            }), 201
        elif role == "customer":
            return jsonify({
                "message": "Account created! Redirecting to Medicine Search.",
                "redirect": "/medicine-search",
                "success": True
            }), 201
        elif role == "admin":
            return jsonify({
                "message": "Account created! Redirecting to Admin Dashboard.",
                "redirect": "/admin-dashboard",
                "success": True
            }), 201

    except psycopg2.Error as e:
        print(f"❌ Database Error: {e}")
        return jsonify({"message": "Database error! Please try again.", "success": False}), 500



# ✅ User Login Route
@app.route("/signin", methods=["POST"])
def signin():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not email or not password or not role:
        return jsonify({"message": "Missing required fields!", "success": False}), 400

    table_name = get_table_name(role)
    if not table_name:
        return jsonify({"message": "Invalid role!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(f"SELECT password FROM {table_name} WHERE email = %s", (email,))
        user = cursor.fetchone()

        cursor.close()
        conn.close()

        if not user:
            return jsonify({"message": "Invalid credentials!", "success": False}), 401

        stored_hashed_password = user[0]

        if bcrypt.checkpw(password.encode("utf-8"), stored_hashed_password.encode("utf-8")):
            # ✅ Correct Role-Based Redirects
            if role == "admin":
                return jsonify({
                    "message": "Admin login successful!",
                    "redirect": "/admin-panel",  # ✅ Admin Panel Redirect
                    "success": True
                }), 200
            elif role == "storeOwner":
                return jsonify({
                    "message": "Store Owner login successful!",
                    "redirect": "/add-medicine",  # ✅ Store Owners go to Add Medicine
                    "success": True
                }), 200
            else:
                return jsonify({
                    "message": "Customer login successful!",
                    "redirect": "/medicine-search",  # ✅ Customers go to Medicine Search
                    "success": True
                }), 200

        return jsonify({"message": "Invalid credentials!", "success": False}), 401

    except psycopg2.Error as e:
        print("❌ Login Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500


# ✅ Store Creation Route
@app.route("/create-store", methods=["POST"])
def create_store():
    data = request.json
    email = data.get("email")
    store_name = data.get("storeName").lower().replace(" ", "_")

    if not email or not store_name:
        return jsonify({"message": "Missing required fields!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Check if the store owner exists in the `owners` table
        cursor.execute("SELECT id FROM owners WHERE email = %s", (email,))
        owner = cursor.fetchone()

        if not owner:
            cursor.close()
            conn.close()
            return jsonify({"message": "Store owner not found! Make sure you signed up as a store owner.", "success": False}), 404

        owner_id = owner[0]

        # ✅ Check if store already exists
        cursor.execute("SELECT id FROM stores WHERE name = %s", (store_name,))
        existing_store = cursor.fetchone()

        if existing_store:
            return jsonify({"message": "Store already exists!", "success": False}), 400

        # ✅ Insert store into `stores` table
        cursor.execute("INSERT INTO stores (name, owner_id) VALUES (%s, %s) RETURNING id", (store_name, owner_id))
        store_id = cursor.fetchone()[0]

        # ✅ Create a medicines table for the store
        store_table_name = f"store_{store_name}_medicines"
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {store_table_name} (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                stock INT NOT NULL,
                price DECIMAL(10, 2) NOT NULL
            )
        """)

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "message": "Store created successfully! Redirecting to Add Medicine.",
            "redirect": "/add-medicine",
            "storeId": store_id,
            "success": True
        }), 201

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500


# ✅ Medicine Addition Route
@app.route("/add-medicine", methods=["POST"])
def add_medicine():
    data = request.json
    email = data.get("email")
    store_name = data.get("storeName")
    medicine_name = data.get("medicineName")
    stock = data.get("stock")
    price = data.get("price")

    if not email or not store_name or not medicine_name or stock is None or price is None:
        return jsonify({"message": "Missing required fields!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Fetch store_id from stores table
        cursor.execute("SELECT id FROM stores WHERE name = %s", (store_name,))
        store = cursor.fetchone()

        if not store:
            return jsonify({"message": "Store not found!", "success": False}), 404

        store_id = store[0]  # ✅ Extract store ID
        print(f"✅ Store ID Retrieved: {store_id}")  # Debugging log

        # ✅ Define the store-specific medicines table
        store_medicine_table = f"store_{store_name.lower().replace(' ', '_')}_medicines"

        # ✅ Ensure the store's medicine table exists
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {store_medicine_table} (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                stock INT NOT NULL,
                price DECIMAL(10, 2) NOT NULL
            )
        """)

        # ✅ Insert medicine into the store's medicines table
        cursor.execute(f"""
            INSERT INTO {store_medicine_table} (name, stock, price)
            VALUES (%s, %s, %s)
        """, (medicine_name, stock, price))

        # ✅ Insert medicine with pharmacy name
        cursor.execute("""
            INSERT INTO medicines (name, store_id, pharmacy, stock, price)
            VALUES (%s, %s, %s, %s, %s)
        """, (medicine_name, store_id, store_name, stock, price))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": f"Medicine added to {store_name}!", "success": True}), 201

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error!", "success": False}), 500




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
def add_admin():
    data = request.json
    admin_email = data.get("adminEmail")  # The email of the existing admin making the request
    new_admin_email = data.get("email")
    new_admin_password = data.get("password")

    if not admin_email or not new_admin_email or not new_admin_password:
        return jsonify({"message": "Missing required fields!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Check if the requester is an existing admin
        cursor.execute("SELECT id FROM admins WHERE email = %s", (admin_email,))
        existing_admin = cursor.fetchone()

        if not existing_admin:
            return jsonify({"message": "Unauthorized! Only admins can add new admins.", "success": False}), 403

        # ✅ Check if the new admin email is already registered
        cursor.execute("SELECT id FROM admins WHERE email = %s", (new_admin_email,))
        if cursor.fetchone():
            return jsonify({"message": "Admin email already exists!", "success": False}), 400

        # ✅ Hash the new admin password
        hashed_pw = bcrypt.hashpw(new_admin_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        # ✅ Insert the new admin into the database
        cursor.execute("INSERT INTO admins (email, password) VALUES (%s, %s)", (new_admin_email, hashed_pw))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "New admin added successfully!", "success": True}), 201

    except psycopg2.Error as e:
        print("❌ Database Error:", e)
        return jsonify({"message": "Database error! Please try again.", "success": False}), 500

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
def delete_store():
    data = request.json
    store_id = data.get("storeId")

    if not store_id:
        return jsonify({"message": "Missing store ID!", "success": False}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ Find the store's name
        cursor.execute("SELECT name FROM stores WHERE id = %s", (store_id,))
        store = cursor.fetchone()

        if not store:
            return jsonify({"message": "Store not found!", "success": False}), 404

        store_name = store[0]
        store_table = f"store_{store_name}_medicines"

        # ✅ Drop the store's medicine table
        cursor.execute(f"DROP TABLE IF EXISTS {store_table}")

        # ✅ Delete the store record
        cursor.execute("DELETE FROM stores WHERE id = %s", (store_id,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Store deleted successfully!", "success": True}), 200

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


if __name__ == "__main__":
    app.run(debug=True)
