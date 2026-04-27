import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

// ── Pagination Args ───────────────────────────────────────────

@InputType()
export class PaginationArgs {
  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 20;

  @Field(() => Int, { defaultValue: 0 })
  @IsInt()
  @Min(0)
  offset: number = 0;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  cursor?: string;
}

// ── Cursor Pagination Args ────────────────────────────────────

@InputType()
export class CursorPaginationArgs {
  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(500)
  first: number = 20;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;
}

// ── Page Info ─────────────────────────────────────────────────

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;

  @Field({ nullable: true })
  startCursor?: string;

  @Field({ nullable: true })
  endCursor?: string;

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  count: number;
}

// ── Paginated Result Factory ──────────────────────────────────

export function buildPageInfo(params: {
  total: number;
  count: number;
  offset?: number;
  limit?: number;
  items?: { id: string }[];
}): PageInfo {
  const { total, count, offset = 0, limit = 20, items = [] } = params;
  return {
    total,
    count,
    hasNextPage: offset + count < total,
    hasPreviousPage: offset > 0,
    startCursor: items.length > 0 ? items[0].id : undefined,
    endCursor: items.length > 0 ? items[items.length - 1].id : undefined,
  };
}
