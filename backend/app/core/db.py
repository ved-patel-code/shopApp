# db.py
from appwrite.client import Client
from appwrite.services.databases import Databases
from config import config

# Setup Appwrite Client
client = Client()
client.set_endpoint(config.APPWRITE_ENDPOINT)  # e.g. http://localhost/v1
client.set_project(config.APPWRITE_PROJECT_ID)
client.set_key(config.APPWRITE_API_KEY)

# Create database service instance
db = Databases(client)
