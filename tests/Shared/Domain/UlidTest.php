<?php

declare(strict_types=1);

namespace App\Tests\Shared\Domain;

use App\Domain\Flat\Room\RoomId;
use App\Tests\UnitTestCase;
use Lcobucci\Clock\FrozenClock;

final class UlidTest extends UnitTestCase
{
    private FrozenClock $clock;

    public function testCreateShouldCreateNewUlidEachTimeIsCalled(): void
    {
        $roomId1 = RoomId::create();
        $roomId2 = RoomId::create();

        self::assertFalse($roomId1->equals($roomId2));
    }

    public function testCreateWithTheSameDateTimeShouldNotCreateTheSameUlid(): void
    {
        $dateTime = $this->clock->now();

        $roomId1 = RoomId::create($dateTime);
        $roomId2 = RoomId::create($dateTime);

        self::assertFalse($roomId1->equals($roomId2));
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->clock = new FrozenClock(new \DateTimeImmutable('05-02-2024 23:15:15'));
    }
}
