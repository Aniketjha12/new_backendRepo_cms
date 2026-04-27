import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ObjectType, Field, InputType } from '@nestjs/graphql';

@ObjectType()
class BusStopType {
  @Field() id: string;
  @Field() routeId: string;
  @Field() name: string;
  @Field(() => Int) order: number;
  @Field() pickupTime: string;
  @Field() dropTime: string;
}

@ObjectType()
class BusRouteType {
  @Field() id: string;
  @Field() routeName: string;
  @Field() routeNumber: string;
  @Field() driverName: string;
  @Field() driverPhone: string;
  @Field() busNumber: string;
  @Field(() => Int) capacity: number;
  @Field(() => [BusStopType]) stops: BusStopType[];
}

@InputType()
class CreateBusRouteInput {
  @Field() routeName: string;
  @Field() routeNumber: string;
  @Field() driverName: string;
  @Field() driverPhone: string;
  @Field() busNumber: string;
  @Field(() => Int) capacity: number;
}

@InputType()
class CreateBusStopInput {
  @Field() routeId: string;
  @Field() name: string;
  @Field(() => Int) order: number;
  @Field() pickupTime: string;
  @Field() dropTime: string;
}

function mapStop(s: any): BusStopType {
  return { id: s.id, routeId: s.routeId, name: s.name, order: s.order, pickupTime: s.pickupTime, dropTime: s.dropTime };
}

function mapRoute(r: any): BusRouteType {
  return { id: r.id, routeName: r.routeName, routeNumber: r.routeNumber, driverName: r.driverName, driverPhone: r.driverPhone, busNumber: r.busNumber, capacity: r.capacity, stops: (r.stops || []).map(mapStop) };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class TransportResolver {
  constructor(private service: TransportService) {}

  @Query(() => [BusRouteType])
  async busRoutes() {
    return (await this.service.findAllRoutes()).map(mapRoute);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => BusRouteType)
  async createBusRoute(@Args('input') input: CreateBusRouteInput) {
    return mapRoute(await this.service.createRoute(input));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => Boolean)
  async deleteBusRoute(@Args('id', { type: () => ID }) id: string) {
    return this.service.deleteRoute(id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => BusStopType)
  async createBusStop(@Args('input') input: CreateBusStopInput) {
    return mapStop(await this.service.createStop(input));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => Boolean)
  async deleteBusStop(@Args('id', { type: () => ID }) id: string) {
    return this.service.deleteStop(id);
  }
}
