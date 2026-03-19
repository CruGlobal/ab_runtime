#!/usr/bin/env bash

# Uses the AB Migration Manager to update every tenant DB to the latest
# schema.

# Import ENV variables
set -o allexport
source .env
set +o allexport

Test=
# Read flags -t for test
while getopts t name
do
    case $name in
    t)    Test="true";;
    esac
done

STACK="${STACKNAME}"
if [[ -n $Test ]]
then
  STACK="${CYPRESS_STACK}"
fi

${PLATFORM} pull docker.io/digiserve/ab-migration-manager:master

SCRIPT_DIR=`dirname -- $0`
ID=`${PLATFORM} container ls -f name=${STACK}_api_sails`
if [ "$ID" == "" ]
then
    echo "${STACK} is not running"
else
    ${PLATFORM} run \
        --network=${STACK}_default \
        -e MYSQL_PASSWORD \
        digiserve/ab-migration-manager:master node app.js
fi
