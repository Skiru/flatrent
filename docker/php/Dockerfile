FROM php:8.3.2-fpm-alpine3.19

# System deps
RUN apk add gcc autoconf libc-dev make

RUN apk add acl $PHPPIZE_DEPS postgresql-dev  && \
    docker-php-ext-install opcache pdo pdo_pgsql && \
    docker-php-ext-enable opcache pdo pdo_pgsql

RUN pecl install ds

COPY ./docker/php/php.ini "$PHP_INI_DIR/php.ini"
COPY --from=composer:2.6.6 /usr/bin/composer /usr/local/bin/composer

ENTRYPOINT ["sh", "/var/www/html/docker/php/entrypoint.sh"]
