<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat;

use App\CreateFlat\Domain\Flat\Address\Address;
use App\CreateFlat\Domain\Flat\Room\Room;
use App\Shared\Domain\DataStructures\Vector;
use App\Shared\Domain\User\UserId;

final readonly class FlatFactory
{
    /**
     * @param Vector<Room> $rooms
     */
    public function create(FlatId $flatId, UserId $ownerId, Address $address, Vector $rooms): Flat
    {
        return new Flat($flatId, $ownerId, $address, $rooms);
    }
}
