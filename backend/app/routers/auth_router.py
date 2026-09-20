from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["Auth"])

ROLE_MODEL_MAP = {
    "admin": models.Admin,
    "teacher": models.Teacher,
    "parent": models.Parent,
}


def current_account(db: Session, current_user: dict):
    """Resolve the JWT payload to the actual Admin / Teacher / Parent row."""
    role = current_user.get("role")
    model = ROLE_MODEL_MAP.get(role)
    if not model:
        raise HTTPException(status_code=401, detail="Unknown account type")
    pk = getattr(model, f"{role}_id")
    account = db.query(model).filter(pk == int(current_user["sub"])).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account no longer exists")
    return account, role


@router.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    role = credentials.role.lower()
    model = ROLE_MODEL_MAP.get(role)
    if not model:
        raise HTTPException(status_code=400, detail="Invalid role. Use admin, teacher, or parent.")

    user = db.query(model).filter(model.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    user_id = getattr(user, f"{role}_id")
    token = auth.create_access_token(data={"sub": str(user_id), "role": role, "email": user.email})

    return schemas.Token(
        access_token=token,
        role=role,
        user_id=user_id,
        name=user.name,
        profile_photo=getattr(user, "profile_photo", None),
    )


@router.get("/me", response_model=schemas.MeOut)
def read_me(db: Session = Depends(get_db), current_user: dict = Depends(auth.get_current_user)):
    account, role = current_account(db, current_user)
    return schemas.MeOut(
        user_id=getattr(account, f"{role}_id"),
        role=role,
        name=account.name,
        email=account.email,
        phone=getattr(account, "phone", None),
        address=getattr(account, "address", None),
        profile_photo=getattr(account, "profile_photo", None),
        employee_id=getattr(account, "employee_id", None),
        father_name=getattr(account, "father_name", None),
        father_phone=getattr(account, "father_phone", None),
        mother_name=getattr(account, "mother_name", None),
        mother_phone=getattr(account, "mother_phone", None),
        class_id=getattr(account, "class_id", None),
    )


@router.put("/me", response_model=schemas.MeOut)
def update_me(
    payload: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(auth.get_current_user),
):
    account, role = current_account(db, current_user)
    data = payload.model_dump(exclude_unset=True)

    # Email is the login handle, so it has to stay unique across that role.
    new_email = data.get("email")
    if new_email and new_email != account.email:
        model = ROLE_MODEL_MAP[role]
        taken = db.query(model).filter(model.email == new_email).first()
        if taken:
            raise HTTPException(status_code=400, detail="That email is already in use")

    for key, value in data.items():
        if hasattr(account, key):
            setattr(account, key, value)
    db.commit()
    db.refresh(account)
    return read_me(db, current_user)


@router.post("/change-password")
def change_password(
    payload: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: dict = Depends(auth.get_current_user),
):
    account, _ = current_account(db, current_user)
    if not auth.verify_password(payload.current_password, account.password_hash):
        raise HTTPException(status_code=400, detail="Your current password is wrong")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    account.password_hash = auth.hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated"}
