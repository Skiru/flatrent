#!/bin/sh

echo "Welcome to entrypoint :)"
set -eux

echo "Setting up var directory permissions - for symfony app"
# Symfony directories permissions based on setfacl function from acl package
HTTPDUSER=$(ps axo user,comm | grep -E '[a]pache|[h]ttpd|[_]www|[w]ww-data|[n]ginx' | grep -v root | head -1 | awk '{print $2}')
setfacl -dR -m u:"$HTTPDUSER":rwX -m u:$(whoami):rwX var
setfacl -R -m u:"$HTTPDUSER":rwX -m u:$(whoami):rwX var

echo "Powering up php-fpm"
php-fpm
