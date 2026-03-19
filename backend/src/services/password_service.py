from passlib.context import CryptContext


# pbkdf2_sha256 is stable in this environment and avoids bcrypt backend issues on Windows/Python 3.13.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
