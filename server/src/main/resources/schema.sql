CREATE TABLE IF NOT EXISTS cameras (
    id          VARCHAR(64) PRIMARY KEY,
    name        VARCHAR(128) NOT NULL,
    type        VARCHAR(32) NOT NULL,
    brand       VARCHAR(64),
    model       VARCHAR(128),
    ip          VARCHAR(64),
    port        INT DEFAULT 554,
    rtsp_url    VARCHAR(512),
    http_url    VARCHAR(512),
    username    VARCHAR(128),
    password    VARCHAR(128),
    channel     INT DEFAULT 1,
    status      VARCHAR(32) DEFAULT 'offline',
    enabled     BOOLEAN DEFAULT TRUE,
    go2rtc_id   VARCHAR(64),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
