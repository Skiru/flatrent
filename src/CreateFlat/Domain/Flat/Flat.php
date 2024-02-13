<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat;

use App\CreateFlat\Domain\Flat\Address\Address;
use App\CreateFlat\Domain\Flat\Room\Room;
use App\CreateFlat\Domain\User\UserId;
use Ds\Vector;

final readonly class Flat
{
    /**
     * @param Vector<Room> $room
     */
    public function __construct(public FlatId $flatId, public UserId $ownerId, Address $address, Vector $room)
    {
    }

    public function isOwner(UserId $userId): bool
    {
        return $this->ownerId->equals($userId);
    }
}
