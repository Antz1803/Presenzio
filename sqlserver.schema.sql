USE Presenzio;
GO

IF OBJECT_ID(N'dbo.lan_state', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.lan_state (
    state_key nvarchar(50) NOT NULL CONSTRAINT PK_lan_state PRIMARY KEY,
    payload nvarchar(max) NOT NULL,
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_lan_state_updated_at DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID(N'dbo.lan_submissions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.lan_submissions (
    attempt_id uniqueidentifier NOT NULL CONSTRAINT PK_lan_submissions PRIMARY KEY,
    payload nvarchar(max) NOT NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_lan_submissions_created_at DEFAULT SYSUTCDATETIME(),
    synced_at datetime2(3) NULL,
    last_error nvarchar(2000) NULL
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = N'CK_lan_state_payload_json'
    AND parent_object_id = OBJECT_ID(N'dbo.lan_state')
)
BEGIN
  ALTER TABLE dbo.lan_state
    ADD CONSTRAINT CK_lan_state_payload_json CHECK (ISJSON(payload) = 1);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = N'CK_lan_submissions_payload_json'
    AND parent_object_id = OBJECT_ID(N'dbo.lan_submissions')
)
BEGIN
  ALTER TABLE dbo.lan_submissions
    ADD CONSTRAINT CK_lan_submissions_payload_json CHECK (ISJSON(payload) = 1);
END;
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.lan_state TO presenzio_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.lan_submissions TO presenzio_app;
GO
