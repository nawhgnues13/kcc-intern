CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE sales_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_name varchar(100) NOT NULL,
  buyer_name varchar(120) NOT NULL,
  vehicle_model varchar(120) NOT NULL,
  sale_date timestamptz NOT NULL,
  branch_name varchar(120),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_registration_id uuid NOT NULL REFERENCES sales_registrations(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE service_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_name varchar(100) NOT NULL,
  customer_name varchar(120) NOT NULL,
  vehicle_model varchar(120) NOT NULL,
  service_date timestamptz NOT NULL,
  repair_details text NOT NULL,
  branch_name varchar(120),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE service_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_registration_id uuid NOT NULL REFERENCES service_registrations(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(200) NOT NULL,
  excerpt text NOT NULL,
  category varchar(30) NOT NULL CHECK (category IN ('IT', 'Vehicle', 'General')),
  image_url text,
  body_text text,
  author_name varchar(120) NOT NULL,
  published_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_registrations_sale_date
  ON sales_registrations (sale_date DESC);

CREATE INDEX idx_service_registrations_service_date
  ON service_registrations (service_date DESC);

CREATE INDEX idx_articles_published_at
  ON articles (published_at DESC);
