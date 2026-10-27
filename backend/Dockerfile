FROM php:8.5-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mysqli zip gd \
    && a2enmod headers rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY backend/ /var/www/html/

RUN chown -R www-data:www-data /var/www/html \
    && printf '%s\n' \
       'log_errors=On' \
       'display_errors=Off' \
       'upload_max_filesize=10M' \
       'post_max_size=12M' \
       'memory_limit=256M' \
       'date.timezone=Africa/Nairobi' \
       > /usr/local/etc/php/conf.d/scott-farm.ini

EXPOSE 80
