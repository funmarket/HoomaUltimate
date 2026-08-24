-- Team lineup pitch coordinates (percent positions on stadium board)
ALTER TABLE "TeamLineupSlot" ADD COLUMN "x" DOUBLE PRECISION NOT NULL DEFAULT 50;
ALTER TABLE "TeamLineupSlot" ADD COLUMN "y" DOUBLE PRECISION NOT NULL DEFAULT 50;
