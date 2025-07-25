if [[ ! -f ./.env ]]; then
   cp ./example.env .env
   echo "Please configure your parameters in the .env file."
fi
if [[ ! -f ./config/local.js ]]; then
   cp ./config/example.local.js ./config/local.js
   echo "Please configure your parameters in the ./cofig/local.js file."
fi
git submodule init && git submodule update
npm run update
