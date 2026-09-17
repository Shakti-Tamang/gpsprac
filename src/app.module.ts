import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsermoduleModule } from './usermodule/usermodule.module';
import { GpsModule } from './gps/gps.module';

@Module({
  imports: [UsermoduleModule, GpsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
