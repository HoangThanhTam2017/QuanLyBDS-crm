import main

needed = {
    ("GET", "/api/properties"),
    ("POST", "/api/properties"),
    ("PUT", "/api/properties/{property_id}"),
    ("DELETE", "/api/properties/{property_id}"),
    ("GET", "/api/properties/check-duplicate"),
    ("GET", "/api/properties/{property_id}/comments"),
    ("POST", "/api/properties/{property_id}/comments"),
    ("POST", "/api/login"),
    ("GET", "/api/me"),
    ("PATCH", "/api/me"),
    ("GET", "/api/users/list"),
    ("POST", "/api/generate-content"),
    ("POST", "/api/properties/compose"),
}
found = {(method, route.path) for route in main.app.routes for method in getattr(route, "methods", set())}
missing = sorted(needed - found)
print("MISSING", len(missing))
for item in missing:
    print("GONE", item[0], item[1])
print("CORS", any(m.cls.__name__ == "CORSMiddleware" for m in main.app.user_middleware))
key = __import__("os").getenv("OPENAI_API_KEY", "").strip()
print("KEY", "SET" if key and key != "thay_api_key_cua_ban_vao_day" else "EMPTY")
print("DB", main.engine.url.get_backend_name())
