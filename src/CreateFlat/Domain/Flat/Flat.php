<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat;

use App\CreateFlat\Domain\Flat\Address\Address;
use App\CreateFlat\Domain\Flat\Room\Room;
use App\CreateFlat\Domain\User\UserId;
use App\Shared\Domain\DataStructures\Vector;

final readonly class Flat
{
    /**
     * @param Vector<Room> $rooms
     */
    public function __construct(
        public FlatId $flatId,
        public UserId $ownerId,
        public Address $address,
        public Vector $rooms,
    ) {
    }

    public function isOwner(UserId $userId): bool
    {
        return $this->ownerId->equals($userId);
    }
}
