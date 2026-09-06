import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { OnlineGateway } from "./online.gateway";

@Module({
  controllers: [AnalyticsController],
  providers: [OnlineGateway],
})
export class AnalyticsModule {}
