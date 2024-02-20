<?php

declare(strict_types=1);

namespace App\CreateFlat\UI\Controller;

class CreateRoomDto
{
    public function __construct(
        public string $roomName,
        public string $roomType,
    ) {
    }
}
