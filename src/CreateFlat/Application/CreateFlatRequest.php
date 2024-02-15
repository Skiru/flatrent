<?php

declare(strict_types=1);

namespace App\CreateFlat\Application;

use Ds\Sequence;
use Ds\Vector;

final readonly class CreateFlatRequest
{
    /**
     * @param Vector<CreateRoomRequest> $createRoomRequest
     */
    public function __construct(
        public string $ownerId,
        public string $address,
        public string $zipCode,
        public Sequence $createRoomRequest,
    ) {
    }
}
