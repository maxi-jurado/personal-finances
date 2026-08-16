"""Tests de la capa de datos: creación de schema e integridad de tipos."""

from sqlalchemy import Float, Numeric, inspect

from app import database, models

EXPECTED_TABLES = {
    "config",
    "exchange_rates",
    "income",
    "categories",
    "credit_cards",
    "card_expenses",
    "monthly_expenses",
    "fixed_expenses",
    "transfers",
}


def test_init_db_creates_all_tables():
    database.init_db()
    tables = set(inspect(database.engine).get_table_names())
    assert EXPECTED_TABLES <= tables


def test_init_db_no_siembra_tarjetas():
    # D17: las tarjetas ya no son fijas, las crea el usuario.
    database.init_db()
    with database.SessionLocal() as db:
        assert db.query(models.CreditCard).count() == 0


def test_init_db_is_idempotent():
    database.init_db()
    database.init_db()
    tables = set(inspect(database.engine).get_table_names())
    assert EXPECTED_TABLES <= tables


def test_currency_enum_is_strictly_three():
    assert {c.value for c in models.Currency} == {"CLP", "JPY", "USD"}


def test_money_columns_use_numeric_not_float():
    money_cols = [
        models.Income.__table__.c.amount,
        models.MonthlyExpense.__table__.c.amount,
        models.FixedExpense.__table__.c.amount,
        models.CardExpense.__table__.c.amount,
        models.CreditCard.__table__.c.credit_limit,
        models.Transfer.__table__.c.clp_charged,
        models.Transfer.__table__.c.jpy_requested,
    ]
    for col in money_cols:
        assert isinstance(col.type, Numeric), f"{col} debe ser Numeric"
        assert not isinstance(col.type, Float), f"{col} no debe ser Float"
