from functools import wraps
from flask import session, jsonify

def role_required(required_roles):
    def wrapper(fn):
        @wraps(fn)
        def decorated_view(*args, **kwargs):
            user_role = session.get("user_role")

            if not user_role:
                return jsonify({"message": "Unauthorized! Please log in.", "success": False}), 401

            if user_role not in required_roles:
                return jsonify({"message": "Forbidden! You don’t have permission.", "success": False}), 403

            return fn(*args, **kwargs)
        return decorated_view
    return wrapper
