#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset
# set -o xtrace

__dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" # Directory where this script exists.
__root="$(cd "$(dirname "${__dir}")" && pwd)"         # Root directory of project.


pb_root="${__root}/src/echo/pb"
cd "${pb_root}"
rm *.ts || true
npx protoc \
	--proto_path="${pb_root}" \
	--plugin=protoc-gen-ts="${__root}/node_modules/.bin/protoc-gen-ts" \
	--ts_out="${pb_root}" \
	*.proto
