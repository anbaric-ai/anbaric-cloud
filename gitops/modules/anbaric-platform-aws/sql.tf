/* The shared app SQL store. A scoped `anbaric_app` login role - created by the
   platform at boot from ANBARIC_APP_DB_PASSWORD - can reach only the
   anbaric_app_data schema, never the platform's own schemas. Its password and
   the app-facing connection URL are minted here: the platform is given the
   password (to create/rotate the role) and the URL secret ARN (to inject into
   every deployed app as ANBARIC_SQL_DATABASE_URL). */

resource "random_password" "app_db" {
  length  = 40
  special = false
}

resource "aws_secretsmanager_secret" "app_db_password" {
  name                    = "anbaric-${var.environment}/app-db-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app_db_password" {
  secret_id     = aws_secretsmanager_secret.app_db_password.id
  secret_string = random_password.app_db.result
}

resource "aws_secretsmanager_secret" "app_db_url" {
  name                    = "anbaric-${var.environment}/app-db-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app_db_url" {
  secret_id     = aws_secretsmanager_secret.app_db_url.id
  secret_string = "postgres://anbaric_app:${random_password.app_db.result}@${aws_db_instance.anbaric.address}:5432/anbaric?sslmode=no-verify"
}
