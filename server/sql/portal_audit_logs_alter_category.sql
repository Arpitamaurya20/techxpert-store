-- If portal_audit_logs already exists from an earlier deploy without 'category', 'delivery' or 'access':
ALTER TABLE techxpertstore.portal_audit_logs
  MODIFY entity ENUM('banner','section','bulk_tier','product','publish','order','category','delivery','access','store') NOT NULL;
