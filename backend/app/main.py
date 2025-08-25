from fastapi import FastAPI, status , HTTPException
from app.core import config
from fastapi.middleware.cors import CORSMiddleware
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.users import Users  
from appwrite.services.account import Account
from app.models.auth_models import UserCreate, UserLogin, VerifyRequest, Token 
from app.services.auth_service import ( 
    create_new_user,
    request_login_token,
    verify_otp_and_create_session,
    create_access_token
)
from datetime import timedelta 
import logging 
from .api import inventory_routes ,  supplier_routes , purchase_routes , pos_routes , customer_routes , report_routes , auth_routes

# --- Create ONE FastAPI app ---
app = FastAPI(title="MyShopApp API")

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

# Register routers
app.include_router(auth_routes.router)
app.include_router(inventory_routes.router)
app.include_router(supplier_routes.router)
app.include_router(purchase_routes.router)
app.include_router(pos_routes.router)
app.include_router(customer_routes.router)
app.include_router(report_routes.router)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

print("--- FastAPI application is starting up... ---")

# Initialize Appwrite Client
client = Client()
client.set_endpoint('https://cloud.appwrite.io/v1')
client.set_project(config.APPWRITE_PROJECT_ID)
client.set_key(config.APPWRITE_API_KEY)

# Initialize Appwrite Services
db = Databases(client)
users_service = Users(client) 
account_service = Account(client)

# --- API Endpoints ---
@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Welcome to MyShopApp Backend!"}

@app.get("/test-connection", tags=["Test"])
def test_appwrite_connection():
    try:
        collections = db.list_collections(database_id=config.APPWRITE_DATABASE_ID)
        return {"status": "success", "collections_found": len(collections['collections'])}
    except Exception as e:
        return {"status": "error", "message": str(e)}

