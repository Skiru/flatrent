<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Room;

enum RoomType
{
    case REGULAR;
    case BATHROOM;
    case KITCHEN;
    case LIVING_ROOM;
    case DINING_ROOM;
}
