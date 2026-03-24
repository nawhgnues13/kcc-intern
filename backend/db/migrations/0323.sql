-- Migration: 2026-03-23 초기 스키마 동기화
-- 팀원 변경사항을 로컬 DB에 반영

-- 1. employees: department → department_code 이름 변경, company_code 추가
ALTER TABLE employees RENAME COLUMN department TO department_code;
ALTER TABLE employees ADD COLUMN company_code varchar(30);

-- 2. users: employee_id 추가
ALTER TABLE users
  ADD COLUMN employee_id uuid UNIQUE REFERENCES employees(id) ON DELETE SET NULL;

-- 3. sales_registrations: 새 컬럼 추가
ALTER TABLE sales_registrations
  ADD COLUMN customer_phone varchar(30),
  ADD COLUMN customer_email varchar(255),
  ADD COLUMN sale_price numeric(12,2),
  ADD COLUMN note text;

-- 4. service_registrations: 새 컬럼 추가
ALTER TABLE service_registrations
  ADD COLUMN customer_phone varchar(30),
  ADD COLUMN customer_email varchar(255),
  ADD COLUMN repair_cost numeric(12,2),
  ADD COLUMN note text;

-- 5. articles: topic 체크 제약 조건에 'pet' 추가
ALTER TABLE articles DROP CONSTRAINT IF EXISTS chk_articles_topic;
ALTER TABLE articles ADD CONSTRAINT chk_articles_topic
  CHECK (topic IN ('automotive', 'it', 'company', 'pet'));

-- 6. photos: photo_description 추가
ALTER TABLE sales_photos ADD COLUMN IF NOT EXISTS photo_description text;
ALTER TABLE service_photos ADD COLUMN IF NOT EXISTS photo_description text;

-- 7. grooming_registrations, grooming_photos 테이블 생성
CREATE TABLE IF NOT EXISTS grooming_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  employee_name varchar(120) NOT NULL,
  customer_name varchar(120) NOT NULL,
  customer_phone varchar(30),
  customer_email varchar(255),
  pet_name varchar(120) NOT NULL,
  pet_type varchar(20),
  breed varchar(120),
  grooming_details text NOT NULL,
  price numeric(12, 2),
  grooming_date timestamptz NOT NULL,
  branch_name varchar(120),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS grooming_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grooming_registration_id uuid NOT NULL REFERENCES grooming_registrations(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  photo_description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 8. content_tasks 테이블 생성
CREATE TABLE IF NOT EXISTS content_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type varchar(30) NOT NULL,
  source_id uuid NOT NULL,
  assigned_employee_id uuid NOT NULL REFERENCES employees(id),
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content_format varchar(30) NOT NULL,
  template_style varchar(100),
  status varchar(30) NOT NULL DEFAULT 'pending',
  article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_content_tasks_source_type CHECK (source_type IN ('sale', 'service', 'grooming')),
  CONSTRAINT chk_content_tasks_content_format CHECK (content_format IN ('blog', 'instagram', 'newsletter')),
  CONSTRAINT chk_content_tasks_status CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped'))
);

-- 9. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users (employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_code ON employees (company_code);
CREATE INDEX IF NOT EXISTS idx_employees_department_code ON employees (department_code);
CREATE INDEX IF NOT EXISTS idx_employees_branch_name ON employees (branch_name);
CREATE INDEX IF NOT EXISTS idx_grooming_registrations_employee_id ON grooming_registrations (employee_id);
CREATE INDEX IF NOT EXISTS idx_grooming_registrations_grooming_date ON grooming_registrations (grooming_date DESC);
CREATE INDEX IF NOT EXISTS idx_grooming_photos_grooming_registration_id ON grooming_photos (grooming_registration_id);
CREATE INDEX IF NOT EXISTS idx_content_tasks_assigned_employee_id ON content_tasks (assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_content_tasks_assigned_user_id ON content_tasks (assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_content_tasks_status ON content_tasks (status);
CREATE INDEX IF NOT EXISTS idx_content_tasks_created_at ON content_tasks (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_tasks_source_format_active
  ON content_tasks (source_type, source_id, content_format) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_tasks_article_id_active
  ON content_tasks (article_id) WHERE article_id IS NOT NULL AND deleted_at IS NULL;

-- 10. 트리거 추가
CREATE TRIGGER trg_grooming_registrations_updated_at
  BEFORE UPDATE ON grooming_registrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_content_tasks_updated_at
  BEFORE UPDATE ON content_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
