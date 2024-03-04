FROM php:8.3.2-fpm-alpine3.19

# System deps
RUN apk add gcc autoconf libc-dev make acl $PHPPIZE_DEPS postgresql-dev  && \
    docker-php-ext-configure intl && \
    docker-php-ext-install opcache pdo pdo_pgsql intl && \
    docker-php-ext-enable opcache pdo pdo_pgsql intl

RUN apk add --update linux-headers
RUN pecl install ds xdebug
RUN docker-php-ext-enable --ini-name xdebug.ini xdebug
COPY ./docker/php/xdebug.ini /usr/local/etc/php/conf.d/xdebug.ini

COPY ./docker/php/php.ini "$PHP_INI_DIR/php.ini"
COPY --from=composer:2.6.6 /usr/bin/composer /usr/local/bin/composer

ENTRYPOINT ["sh", "/var/www/html/docker/php/entrypoint.sh"]
