rm ./drop_all_tables.sql

## gotta ignore foreigh key checks
echo "SET FOREIGN_KEY_CHECKS = 0;" > ./drop_all_tables.sql

## PUll all our tables out of the dump:
( mariadb-dump --add-drop-table --no-data -u $DB_USER -p$DB_PASSWORD "appbuilder-$TENANT" | grep 'DROP TABLE' ) >> ./drop_all_tables.sql

## Remove all our remaining Views as well:
echo \
"SET @views = NULL; 
SELECT GROUP_CONCAT('\`',table_schema, '\`.', table_name) INTO @views \
 FROM information_schema.views  \
 WHERE table_schema = \"appbuilder-admin\"; \
\
SET @views = IFNULL(CONCAT('DROP VIEW ', @views), 'SELECT \"No Views\"'); \
PREPARE stmt FROM @views; \
EXECUTE stmt; \
DEALLOCATE PREPARE stmt; " \
>> ./drop_all_tables.sql

## Now turn back on foreign key checks
echo "SET FOREIGN_KEY_CHECKS = 1;" >> ./drop_all_tables.sql

mariadb -u $DB_USER -p$DB_PASSWORD "appbuilder-$TENANT" < ./drop_all_tables.sql
mariadb -u $DB_USER -p$DB_PASSWORD "appbuilder-$TENANT" < ./sql/reset.sql
mariadb -u $DB_USER -p$DB_PASSWORD "appbuilder-$TENANT" < ./sql/reset_tenant.sql