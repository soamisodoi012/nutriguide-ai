import os
from dotenv import load_dotenv
import urllib.parse as up

load_dotenv()

class Config:
    # Check if Railway provides DATABASE_URL
    DATABASE_URL = os.getenv("DATABASE_URL")

    if DATABASE_URL:
        # Parse the URL: postgres://user:pass@host:port/db
        up.uses_netloc.append("postgres")
        url = up.urlparse(DATABASE_URL)

        DB_HOST = url.hostname
        DB_NAME = url.path[1:]  # strip leading "/"
        DB_USER = url.username
        DB_PASSWORD = url.password
        DB_PORT = url.port
        SSL_MODE = "require"
    else:
        # Local development fallback
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_NAME = os.getenv("DB_NAME", "nutriguide")
        DB_USER = os.getenv("DB_USER", "postgres")
        DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
        DB_PORT = os.getenv("DB_PORT", "5432")
        SSL_MODE = None

    # App config
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
