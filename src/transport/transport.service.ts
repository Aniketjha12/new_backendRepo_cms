import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransportService {
  constructor(private prisma: PrismaService) {}

  async findAllRoutes() {
    return this.prisma.busRoute.findMany({
      include: { stops: { orderBy: { order: 'asc' } } },
      orderBy: { routeName: 'asc' },
    });
  }

  async createRoute(input: {
    routeName: string;
    routeNumber: string;
    driverName: string;
    driverPhone: string;
    busNumber: string;
    capacity: number;
  }) {
    return this.prisma.busRoute.create({ data: input, include: { stops: true } });
  }

  async updateRoute(id: string, input: Partial<{
    routeName: string;
    routeNumber: string;
    driverName: string;
    driverPhone: string;
    busNumber: string;
    capacity: number;
  }>) {
    return this.prisma.busRoute.update({ where: { id }, data: input, include: { stops: true } });
  }

  async deleteRoute(id: string) {
    await this.prisma.busRoute.delete({ where: { id } });
    return true;
  }

  async createStop(input: {
    routeId: string;
    name: string;
    order: number;
    pickupTime: string;
    dropTime: string;
  }) {
    return this.prisma.busStop.create({ data: input });
  }

  async updateStop(id: string, input: Partial<{
    name: string;
    order: number;
    pickupTime: string;
    dropTime: string;
  }>) {
    return this.prisma.busStop.update({ where: { id }, data: input });
  }

  async deleteStop(id: string) {
    await this.prisma.busStop.delete({ where: { id } });
    return true;
  }
}
