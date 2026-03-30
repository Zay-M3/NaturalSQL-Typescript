export const CONNECTION_TEMPLATES = Object.freeze({
    postgresql: "postgresql://{user}:{password}@{host}:{port}/{database}",
    mysql: "mysql://{user}:{password}@{host}:{port}/{database}",
    sqlite: "sqlite:///{database}",
    sqlserver:
        "mssql://{user}:{password}@{host}:{port}/{database}?driver=ODBC+Driver+17+for+SQL+Server"
} as const);

export const IGNORE_TABLE: ReadonlySet<string> = new Set([
    "alembic_version",
    "django_migrations",
    "schema_migrations",
    "flyway_schema_history",
    "__efmigrationshistory",
    "celery",
    "celery_taskmeta",
    "celery_tasksetmeta",
    "langchain_pg_collection",
    "langchain_pg_embedding",
    "vector_store",
    "embeddings",
    "sqlite_sequence"
]);

export const IGNORE_TABLES = IGNORE_TABLE;
