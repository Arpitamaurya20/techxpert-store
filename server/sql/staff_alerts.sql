-- Staff notice when a customer places an order or sends a Talk to us request.
-- Safe to run again. An order staff place themselves is not written here.
-- No phone number and no customer name are stored.

CREATE TABLE IF NOT EXISTS techxpertstore.staff_alerts (
  ID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  Kind ENUM('order', 'request') NOT NULL,
  StoreID INT NOT NULL,
  SubjectID INT NOT NULL,
  Headline VARCHAR(80) NOT NULL,
  Detail VARCHAR(200) NOT NULL,
  Seen TINYINT(1) NOT NULL DEFAULT 0,
  CreatedDate DATE NOT NULL,
  CreatedTime TIME NOT NULL,
  UNIQUE KEY uq_staff_alert (Kind, SubjectID),
  INDEX idx_staff_alerts_open (Seen, StoreID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
