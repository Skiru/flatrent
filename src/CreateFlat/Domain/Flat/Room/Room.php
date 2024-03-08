<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Room;

final readonly class Room
{
    public function __construct(public RoomId $id, public RoomName $name, public RoomType $roomType)
    {
    }
}
