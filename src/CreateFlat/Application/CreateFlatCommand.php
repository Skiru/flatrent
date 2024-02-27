<?php

declare(strict_types=1);

namespace App\CreateFlat\Application;

use App\CreateFlat\Domain\Flat\Address\Address;
use App\CreateFlat\Domain\Flat\FlatId;
use App\CreateFlat\Domain\Flat\Room\Room;
use App\CreateFlat\Domain\User\UserId;
use App\Shared\Domain\DataStructures\Vector;
use App\Shared\SyncMessageInterface;

final readonly class CreateFlatCommand implements SyncMessageInterface
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
}
