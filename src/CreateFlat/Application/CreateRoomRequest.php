<?php

declare(strict_types=1);

namespace App\CreateFlat\Application;

final readonly class CreateRoomRequest
{
    public function __construct(
        public string $roomName,
        public string $roomType,
    ) {
    }
}
