from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import bcrypt

app = Flask(__name__)
CORS(app)

# PostgreSQL Connection
conn = psycopg2.connect(
    dbname="pillfinder_db", user="postgres", password="mrk123456", host="localhost", port="5432"
)
cursor = conn.cursor()

# Create users table if not exists
cursor.execute(
    """CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL
    )"""
) 
conn.commit()

# Sign Up Route
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    hashed_pw = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    try:
        cursor.execute(
            "INSERT INTO users (email, password, role) VALUES (%s, %s, %s)",
            (data["email"], hashed_pw, data["role"]),
        )
        conn.commit()
        return jsonify({"message": "Account created successfully!"}), 201
    except Exception as e:
        return jsonify({"message": "User already exists!"}), 400

# Sign In Route
@app.route("/signin", methods=["POST"])
def signin():
    data = request.json
    cursor.execute("SELECT password FROM users WHERE email = %s", (data["email"],))
    user = cursor.fetchone()

    if user and bcrypt.checkpw(data["password"].encode("utf-8"), user[0].encode("utf-8")):
        return jsonify({"message": "Login successful!"})
    return jsonify({"message": "Invalid credentials!"}), 401

if __name__ == "__main__":
    app.run(debug=True)
