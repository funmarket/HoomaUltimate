CREATE TYPE "GearUpPaymentMethod" AS ENUM ('CASH', 'CRYPTO', 'CARD_BY_PHONE');

ALTER TABLE "GearUpShop"
  ADD COLUMN "paymentMethods" "GearUpPaymentMethod"[] NOT NULL
  DEFAULT ARRAY[]::"GearUpPaymentMethod"[];
