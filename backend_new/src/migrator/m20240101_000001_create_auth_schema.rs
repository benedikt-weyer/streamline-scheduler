use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_schema(
                Schema::create()
                    .schema(Alias::new("auth"))
                    .if_not_exists()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_schema(
                Schema::drop()
                    .schema(Alias::new("auth"))
                    .if_exists()
                    .cascade()
                    .to_owned(),
            )
            .await
    }
}
