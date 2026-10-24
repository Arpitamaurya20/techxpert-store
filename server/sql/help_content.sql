-- Help and support content the app will read. Run against techxpertstore after portal_audit_logs.sql.
-- Safe to run again. Starts empty: staff fill the phone, WhatsApp, email, hours and questions later.

CREATE TABLE IF NOT EXISTS help_contact (
  ID TINYINT NOT NULL PRIMARY KEY,
  Phone VARCHAR(20) NOT NULL DEFAULT '',
  PhoneLabel VARCHAR(40) NOT NULL DEFAULT '',
  Whatsapp VARCHAR(20) NOT NULL DEFAULT '',
  Email VARCHAR(120) NOT NULL DEFAULT '',
  Hours VARCHAR(80) NOT NULL DEFAULT '',
  UpdatedDate DATE NULL,
  UpdatedTime TIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO help_contact (ID) VALUES (1);

CREATE TABLE IF NOT EXISTS help_faqs (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Question VARCHAR(300) NOT NULL,
  Answer VARCHAR(2000) NOT NULL,
  Position INT NOT NULL,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  INDEX idx_help_faqs_position (Position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE portal_audit_logs
  MODIFY entity ENUM(
    'banner','section','bulk_tier','product','publish','order','category','delivery','access','store','help'
  ) NOT NULL;
