<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Room;

final readonly class RoomName
{
    public function __construct(public string $name)
    {
    }
}
