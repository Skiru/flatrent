<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Room;

use App\Shared\Domain\DataStructures\Vector;
use UnitEnum;

enum RoomType
{
    case REGULAR;
    case BATHROOM;
    case KITCHEN;
    case LIVING_ROOM;
    case DINING_ROOM;

    /** @return array<int, string> */
    public static function values(): array
    {
        return Vector::fromArray(self::cases())->transform(static fn(UnitEnum $unit): string => $unit->name)->toArray();
    }

    public static function fromString(string $type): self
    {
        return Vector::fromArray(self::cases())->
    }
}
