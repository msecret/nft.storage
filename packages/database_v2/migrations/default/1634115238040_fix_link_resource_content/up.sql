-- Function updates state of the resource to `ContentLinked`.
-- It also creates corresponding entries in content and pin
-- tables unless they already exist.

CREATE OR REPLACE FUNCTION link_resource_content (--
 uri_hash resource .uri_hash % TYPE,--
 ipfs_url resource .ipfs_url % TYPE,--
 dag_size content.dag_size % TYPE, -- Unlike resource table here we require following
 -- two columns
 cid TEXT, --
 status_text TEXT, -- BY default use niftysave cluster
 pin_service pin.service % TYPE DEFAULT 'IpfsCluster2') RETURNS
SETOF resource AS $$
DECLARE
  hash resource .uri_hash % TYPE;
  resource_ipfs_url resource .ipfs_url % TYPE;
  pin_id pin.id % TYPE;
  status_message resource.status_text % TYPE;
BEGIN
  hash := uri_hash;
  resource_ipfs_url := ipfs_url;
  status_message := status_text;

  -- Ensure that non `ContentLinked` resource with this hash exists.
  IF NOT EXISTS (
    SELECT
    FROM
      resource
    WHERE
      resource .uri_hash = hash
  ) THEN RAISE
  EXCEPTION
    'resource with uri_hash % does not exists',
    hash;
  END IF;

 
  -- Create content record for the resource unless already exists.
  INSERT INTO
    content (cid, dag_size)
  VALUES
    (cid, dag_size)
  ON CONFLICT
  ON CONSTRAINT content_pkey DO
  UPDATE
  SET
    updated_at = EXCLUDED.updated_at;

  UPDATE
    resource
  SET
    status = 'ContentLinked',
    status_text = status_message,
    ipfs_url = resource_ipfs_url,
    content_cid = cid,
    updated_at = timezone('utc' :: text, now())
  WHERE
    resource.uri_hash = hash;
    
  -- Create a pin record for the content unless already exists.
  INSERT INTO
    pin (content_cid, service, status)
  VALUES
    (cid, pin_service, 'PinQueued')
  ON CONFLICT
  ON CONSTRAINT pin_content_cid_service_key DO
    UPDATE
    SET
      updated_at = EXCLUDED.updated_at --
      -- Capture pin.id
      RETURNING pin.id INTO pin_id;


  RETURN QUERY
  SELECT
    *
  FROM
    resource
  WHERE
    resource .uri_hash = hash;
END;

$$ LANGUAGE plpgsql;
