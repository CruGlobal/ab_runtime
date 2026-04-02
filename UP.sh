#!/bin/bash

# Import ENV variables
set -o allexport
source .env
set +o allexport

Dev=
Test=
Quiet=
# Read flags -d for dev, -t for test, -q for no logs
while getopts dtq name
do
    case $name in
    d)    Dev="true";;
    t)    Test="true";;
    q)    Quiet="true"
    esac
done

if [ "$NODE_ENV" == "development" ];
then
    Dev="true"
fi

# Stack/project name from .env; test mode (-t) uses CYPRESS_STACK
STACK="${STACKNAME}"
if [[ -n $Test ]]
then
  STACK="${CYPRESS_STACK}"
fi

File="docker-compose.yml"
TestOverride=""
if [[ -n $Dev ]]
then
    File="docker-compose.dev.yml"
fi
if [[ -n "$SYSTEMD_SERVICE" && -z $Dev ]]; then
	systemctl --user start ${SYSTEMD_SERVICE}.service
elif [ "$PLATFORM" = "podman" ]; then
   if [[ -n $Test ]]
   then
     TestOverride="-f ./test/setup/ci-test.overide.yml"
   fi
   podman compose -f $File -f docker-compose.override.yml $TestOverride -p $STACK up -d
else
   nohup node ab_system_monitor.js &> /dev/null &
   if [[ -n $Test ]]
   then
      TestOverride="-c ./test/setup/ci-test.overide.yml"
   fi
   docker stack deploy -c $File -c docker-compose.override.yml $TestOverride $STACK -d
fi
if [[ -z $Quiet ]]
then
./logs.js
fi
