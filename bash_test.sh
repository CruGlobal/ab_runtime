if [ "$(git branch | grep "*" | awk '{print $2}')" = "master" ]; then
	echo "true"
else
	echo "false"
fi
