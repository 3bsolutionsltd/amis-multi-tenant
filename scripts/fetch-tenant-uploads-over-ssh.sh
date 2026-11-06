#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$#" -ne 4 ]; then
  echo "Usage: $0 <ssh-host-alias> <source-api-container-id> <upload-manifest> <empty-destination-dir>" >&2
  exit 2
fi

ssh_host=$1
api_container=$2
manifest=$3
destination=$4

if [[ ! "$ssh_host" =~ ^[A-Za-z0-9._@-]+$ || "$ssh_host" == -* ]]; then
  echo "SSH host must be a host name or configured SSH alias" >&2
  exit 2
fi
if [[ ! "$api_container" =~ ^[a-fA-F0-9]{12,64}$ ]]; then
  echo "Source API container ID must be a Docker container ID" >&2
  exit 2
fi
if [ ! -f "$manifest" ]; then
  echo "Upload manifest does not exist" >&2
  exit 2
fi
mkdir -p "$destination"
if find "$destination" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
  echo "Destination directory must be empty" >&2
  exit 2
fi
chmod 700 "$destination"

count=0
temporary_file=
control_directory=$(mktemp -d)
chmod 700 "$control_directory"
control_path="$control_directory/%C"
ssh_options=(-o ControlMaster=auto -o ControlPath="$control_path" -o ControlPersist=120)
cleanup() {
  if [ -n "$temporary_file" ] && [ -f "$temporary_file" ]; then
    rm -f -- "$temporary_file"
  fi
  ssh -S "$control_path" -O exit "$ssh_host" >/dev/null 2>&1 || true
  rm -rf -- "$control_directory"
}
trap cleanup EXIT

while IFS= read -r reference || [ -n "$reference" ]; do
  if [[ ! "$reference" =~ ^/uploads/([A-Za-z0-9_-][A-Za-z0-9._-]*)$ ]]; then
    echo "Upload manifest contains an unsupported reference" >&2
    exit 2
  fi
  file_name=${BASH_REMATCH[1]}
  remote_path="/app/apps/api/uploads/$file_name"
  remote_command="sudo docker exec $api_container sha256sum -- $remote_path"
  remote_hash_line=$(ssh "${ssh_options[@]}" "$ssh_host" "$remote_command")
  remote_hash=${remote_hash_line%%[[:space:]]*}
  if [[ ! "$remote_hash" =~ ^[a-fA-F0-9]{64}$ ]]; then
    echo "Could not verify a referenced source upload" >&2
    exit 1
  fi

  temporary_file="$destination/.${file_name}.partial"
  if [ -e "$destination/$file_name" ] || [ -e "$temporary_file" ]; then
    echo "Refusing to overwrite an existing destination file" >&2
    exit 1
  fi
  if ! ssh "${ssh_options[@]}" "$ssh_host" \
    "sudo docker exec $api_container cat -- $remote_path" > "$temporary_file"; then
    rm -f -- "$temporary_file"
    echo "Could not fetch a referenced source upload over SSH" >&2
    exit 1
  fi

  local_hash=$(sha256sum -- "$temporary_file" | cut -d ' ' -f 1)
  if [ "$local_hash" != "$remote_hash" ]; then
    rm -f -- "$temporary_file"
    temporary_file=
    echo "A referenced upload failed SHA-256 verification" >&2
    exit 1
  fi
  ln -- "$temporary_file" "$destination/$file_name"
  rm -- "$temporary_file"
  temporary_file=
  count=$((count + 1))
done < "$manifest"

echo "Fetched and verified $count referenced upload(s)."
