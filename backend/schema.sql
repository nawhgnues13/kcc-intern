CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id varchar(100) NOT NULL UNIQUE,
  password varchar(255) NOT NULL,
  name varchar(120) NOT NULL,
  role varchar(30) NOT NULL DEFAULT 'admin',
  company_name varchar(120),
  job_title varchar(120),
  profile_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_users_role CHECK (role IN ('admin', 'staff'))
);

CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  email varchar(255),
  phone varchar(30),
  department varchar(120),
  position varchar(120),
  branch_name varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  phone varchar(30),
  email varchar(255),
  branch_name varchar(120),
  is_marketing_agreed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE sales_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  employee_name varchar(120) NOT NULL,
  customer_id uuid REFERENCES customers(id),
  customer_name varchar(120) NOT NULL,
  vehicle_model varchar(120) NOT NULL,
  sale_date timestamptz NOT NULL,
  branch_name varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE sales_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_registration_id uuid NOT NULL REFERENCES sales_registrations(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE service_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id),
  employee_name varchar(120) NOT NULL,
  customer_id uuid REFERENCES customers(id),
  customer_name varchar(120) NOT NULL,
  vehicle_model varchar(120) NOT NULL,
  service_date timestamptz NOT NULL,
  repair_details text NOT NULL,
  branch_name varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE service_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_registration_id uuid NOT NULL REFERENCES service_registrations(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_format varchar(30) NOT NULL,
  topic varchar(30),
  template_style varchar(100) NOT NULL,
  title varchar(200),
  body_content jsonb NOT NULL,
  generation_meta jsonb,
  author_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_articles_content_format CHECK (content_format IN ('newsletter', 'blog', 'instagram')),
  CONSTRAINT chk_articles_topic CHECK (topic IN ('automotive', 'it', 'company'))
);

CREATE TABLE article_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE article_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  source_type varchar(30) NOT NULL,
  original_name varchar(255),
  source_url text,
  storage_url text,
  mime_type varchar(100),
  extracted_text text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_article_sources_type CHECK (source_type IN ('url', 'pdf', 'image'))
);

CREATE TABLE article_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL,
  message_text text NOT NULL,
  message_kind varchar(30),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_article_ai_messages_role CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE TABLE article_sales_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  sales_registration_id uuid NOT NULL REFERENCES sales_registrations(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE article_service_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  service_registration_id uuid NOT NULL REFERENCES service_registrations(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sales_registrations_updated_at BEFORE UPDATE ON sales_registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_service_registrations_updated_at BEFORE UPDATE ON service_registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_sales_registrations_employee_id ON sales_registrations (employee_id);
CREATE INDEX idx_sales_registrations_customer_id ON sales_registrations (customer_id);
CREATE INDEX idx_sales_registrations_sale_date ON sales_registrations (sale_date DESC);
CREATE INDEX idx_sales_photos_sales_registration_id ON sales_photos (sales_registration_id);
CREATE INDEX idx_service_registrations_employee_id ON service_registrations (employee_id);
CREATE INDEX idx_service_registrations_customer_id ON service_registrations (customer_id);
CREATE INDEX idx_service_registrations_service_date ON service_registrations (service_date DESC);
CREATE INDEX idx_service_photos_service_registration_id ON service_photos (service_registration_id);
CREATE INDEX idx_articles_author_user_id ON articles (author_user_id);
CREATE INDEX idx_articles_content_format ON articles (content_format);
CREATE INDEX idx_articles_topic ON articles (topic);
CREATE INDEX idx_articles_template_style ON articles (template_style);
CREATE INDEX idx_articles_created_at ON articles (created_at DESC);
CREATE INDEX idx_article_images_article_id ON article_images (article_id);
CREATE INDEX idx_article_sources_article_id ON article_sources (article_id);
CREATE INDEX idx_article_sources_source_type ON article_sources (source_type);
CREATE INDEX idx_article_ai_messages_article_id ON article_ai_messages (article_id);
CREATE INDEX idx_article_ai_messages_created_at ON article_ai_messages (article_id, created_at);
CREATE INDEX idx_article_sales_sources_article_id ON article_sales_sources (article_id);
CREATE INDEX idx_article_sales_sources_sales_registration_id ON article_sales_sources (sales_registration_id);
CREATE INDEX idx_article_service_sources_article_id ON article_service_sources (article_id);
CREATE INDEX idx_article_service_sources_service_registration_id ON article_service_sources (service_registration_id);
